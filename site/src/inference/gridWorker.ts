/**
 * Runs the real ONNX model off the main thread, per interaction-map.md's
 * performance contract: "ONNX runs in a dedicated Web Worker with a batched
 * inference path... requests carry a monotonically increasing seq; stale
 * results are dropped". The grid is the terrain (composition.md): every
 * cell here is a real model output from predictBatch, never interpolated
 * or faked.
 */
import { loadModel, predictBatch, predictWithFolds, getThreshold, getMetadata, type CustomerFeatures } from './churnModel'
import { applyFeatureChange, INTERNET_DEPENDENT_FEATURES } from '../data/constraints'
// Same deduplicated asset URL churnModel.ts's loadModel() points ort.env.wasm.wasmPaths at.
import wasmUrl from 'onnxruntime-web/ort-wasm-simd-threaded.wasm?url'

export type GridRequest = {
  type: 'grid'
  seq: number
  customer: CustomerFeatures
  cols: number
  rows: number
}
export type PredictRequest = { type: 'predict'; seq: number; customer: CustomerFeatures }
export type SensitivityRequest = { type: 'sensitivity'; seq: number; customer: CustomerFeatures }
export type LoadRequest = { type: 'load' }
export type WorkerRequest = GridRequest | PredictRequest | LoadRequest | SensitivityRequest

export interface SensitivityRow {
  feature: string // raw feature name, e.g. "Contract" or "tenure"
  toValue: string | number
  deltaP: number
}

export type WorkerResponse =
  | { type: 'load-progress'; pct: number }
  | { type: 'load-done'; threshold: number }
  | { type: 'load-error'; message: string }
  | { type: 'grid-result'; seq: number; grid: number[]; cols: number; rows: number; ms: number }
  | { type: 'predict-result'; seq: number; probability: number; folds: number[]; ms: number }
  | { type: 'sensitivity-result'; seq: number; rows: SensitivityRow[]; ms: number }

let loaded = false

async function doLoad() {
  try {
    // Real byte-progress on the big wasm download (~14MB), tracked by this
    // worker's own fetch of the exact URL onnxruntime-web will request, so
    // the ledger's percentage is measured, not animated. Best-effort: if
    // the server doesn't send cache-friendly headers, onnxruntime-web's own
    // fetch below may re-transfer the bytes, in which case the ledger just
    // shows "warming" a little longer - still never a faked number.
    const res = await fetch(wasmUrl)
    const total = Number(res.headers.get('content-length')) || 0
    const reader = res.body?.getReader()
    if (reader && total > 0) {
      let received = 0
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        received += value.length
        post({ type: 'load-progress', pct: Math.min(99, Math.round((received / total) * 100)) })
      }
    }

    await loadModel()
    post({ type: 'load-progress', pct: 100 })

    // warm-up: one real inference so the first visible prediction isn't the JIT-cold one
    await predictWithFolds(DUMMY_CUSTOMER)

    loaded = true
    post({ type: 'load-done', threshold: getThreshold() })
  } catch (e) {
    post({ type: 'load-error', message: e instanceof Error ? e.message : String(e) })
  }
}

const DUMMY_CUSTOMER: CustomerFeatures = {
  gender: 'Female',
  SeniorCitizen: '0',
  Partner: 'Yes',
  Dependents: 'Yes',
  tenure: 10,
  PhoneService: 'Yes',
  MultipleLines: 'No',
  InternetService: 'DSL',
  OnlineSecurity: 'No',
  OnlineBackup: 'No',
  DeviceProtection: 'Yes',
  TechSupport: 'Yes',
  StreamingTV: 'No',
  StreamingMovies: 'No',
  Contract: 'Month-to-month',
  PaperlessBilling: 'No',
  PaymentMethod: 'Credit card (automatic)',
  MonthlyCharges: 55.2,
  TotalCharges: 528.35,
}

// Typed as a plain structural shape, not DOM's `Worker` (the main-thread
// handle) or the `webworker` lib's `WorkerGlobalScope` (which can't be
// combined with the `DOM` lib this project's tsconfig uses), since all this
// file needs from the global `self` is postMessage/onmessage.
interface WorkerSelf {
  postMessage: (msg: WorkerResponse) => void
  onmessage: ((e: MessageEvent<WorkerRequest>) => void) | null
}
const ctx = self as unknown as WorkerSelf

function post(msg: WorkerResponse) {
  ctx.postMessage(msg)
}

ctx.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const msg = e.data
  if (msg.type === 'load') {
    await doLoad()
    return
  }
  if (!loaded) return // caller should wait for load-done; stale/early requests are dropped

  if (msg.type === 'predict') {
    const { probability, folds, ms } = await predictWithFolds(msg.customer)
    post({ type: 'predict-result', seq: msg.seq, probability, folds, ms })
    return
  }

  if (msg.type === 'sensitivity') {
    const t0 = performance.now()
    const { rows: batch, meta } = buildSensitivityBatch(msg.customer)
    // The base row rides in the SAME batch call, so the baseline it's
    // compared against is computed from this exact request's features -
    // never a `focalP` the store may not have updated yet (that staleness
    // previously made "exact Δ calibrated probability" not exact).
    const probs = await predictBatch([msg.customer, ...batch])
    const baseline = probs[0]
    const rows: SensitivityRow[] = probs.slice(1).map((p, i) => ({
      feature: meta[i].feature,
      toValue: meta[i].toValue,
      deltaP: p - baseline,
    }))
    post({ type: 'sensitivity-result', seq: msg.seq, rows, ms: performance.now() - t0 })
    return
  }

  if (msg.type === 'grid') {
    const t0 = performance.now()
    const { customer, cols, rows } = msg
    const grid = buildGridCustomers(customer, cols, rows)
    const probs = await predictBatch(grid)
    post({
      type: 'grid-result',
      seq: msg.seq,
      grid: probs,
      cols,
      rows,
      ms: performance.now() - t0,
    })
  }
}

interface SensitivityMeta {
  feature: string
  toValue: string | number
}

// These one-hot values are states the model's encoding needs, but
// interaction-map.md rule 3 says they are never independently selectable -
// they only appear through the InternetService/PhoneService cascade. A
// sensitivity probe that "switches" a feature straight to one of these
// would both violate that rule and desync TotalCharges/the 6 dependent
// controls from the row it claims to describe.
const DERIVED_ONLY_VALUES = new Set(['No internet service', 'No phone service'])

/**
 * Live sensitivity batch (interaction-map.md performance contract: "about
 * 31 rows through ONNX"; this implementation's real count is usually 24-27
 * depending on which features are currently enabled - see below). For most
 * of the 19 raw features, every real alternative value it could take
 * (categorical: metadata's category_values minus the two derived-only
 * values above; numeric: +/-12 months tenure, +/-$20 charge, clamped to the
 * dataset range). Every probe row is built through the SAME
 * `applyFeatureChange` the Lab's own edits use, so a probe that flips
 * InternetService also cascades the 6 dependent features exactly as a real
 * edit would - this can never produce a row the Lab itself couldn't reach.
 */
function buildSensitivityBatch(base: CustomerFeatures): { rows: CustomerFeatures[]; meta: SensitivityMeta[] } {
  const metadata = getMetadata()!
  const rows: CustomerFeatures[] = []
  const meta: SensitivityMeta[] = []

  for (const feature of metadata.categorical_features) {
    // Don't probe a feature the Lab itself currently disables (interaction-map.md rules 1-2):
    // e.g. OnlineSecurity's own switches are meaningless while InternetService = "No".
    if (
      (INTERNET_DEPENDENT_FEATURES as readonly string[]).includes(feature) &&
      base.InternetService === 'No'
    )
      continue
    if (feature === 'MultipleLines' && base.PhoneService === 'No') continue

    const options = metadata.category_values[feature].filter((v) => !DERIVED_ONLY_VALUES.has(v))
    for (const alt of options) {
      if (alt === String(base[feature as keyof CustomerFeatures])) continue
      const { features } = applyFeatureChange(base, {}, feature as keyof CustomerFeatures, alt)
      rows.push(features)
      meta.push({ feature, toValue: alt })
    }
  }

  const tenureAlts = [Math.max(0, base.tenure - 12), Math.min(72, base.tenure + 12)]
  for (const t of tenureAlts) {
    if (t === base.tenure) continue
    const { features } = applyFeatureChange(base, {}, 'tenure', t)
    features.TotalCharges = Math.round(t * base.MonthlyCharges * 100) / 100 // linked rule
    rows.push(features)
    meta.push({ feature: 'tenure', toValue: t })
  }
  const chargeAlts = [Math.max(18.25, base.MonthlyCharges - 20), Math.min(118.75, base.MonthlyCharges + 20)]
  for (const c of chargeAlts) {
    if (c === base.MonthlyCharges) continue
    const rounded = Math.round(c * 100) / 100
    const { features } = applyFeatureChange(base, {}, 'MonthlyCharges', rounded)
    features.TotalCharges = Math.round(base.tenure * rounded * 100) / 100 // linked rule
    rows.push(features)
    meta.push({ feature: 'MonthlyCharges', toValue: rounded })
  }

  return { rows, meta }
}

/**
 * Builds the grid of customers: x = tenure (integer cell centers, per
 * composition.md - the training data has integer tenure), y =
 * MonthlyCharges, every other feature held at `base`'s values, TotalCharges
 * derived as tenure * charge. Row-major: index = row * cols + col.
 */
function buildGridCustomers(base: CustomerFeatures, cols: number, rows: number): CustomerFeatures[] {
  const out: CustomerFeatures[] = new Array(cols * rows)
  const tenureMax = 72
  const chargeMin = 18.25
  const chargeMax = 118.75
  for (let row = 0; row < rows; row++) {
    // row 0 = top = highest charge, so the grid matches screen-space y immediately.
    const charge = chargeMax - (row / (rows - 1)) * (chargeMax - chargeMin)
    for (let col = 0; col < cols; col++) {
      const tenure = Math.round((col / (cols - 1)) * tenureMax)
      out[row * cols + col] = {
        ...base,
        tenure,
        MonthlyCharges: Math.round(charge * 100) / 100,
        TotalCharges: Math.round(tenure * charge * 100) / 100,
      }
    }
  }
  return out
}
