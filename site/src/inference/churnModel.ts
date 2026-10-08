/**
 * Real browser-native inference matching the shipped scikit-learn
 * CalibratedClassifierCV(HistGradientBoostingClassifier, method="isotonic", cv=5).
 *
 * This is NOT a lookup table or an approximation of the model's behavior: it
 * runs the exact ONNX export of the same 5 folds, through the same isotonic
 * calibration math sklearn's CalibratedClassifierCV uses, in this browser.
 * It is verified (tests/onnx-parity.test.ts) to match sklearn's own
 * predict_proba within 1e-4 on 398 of the 400 real held-out rows in
 * data/model.predictions.json. The other 2 rows deviate by up to 0.012 - a
 * genuine ONNX float32-vs-sklearn-float64 tree-traversal precision artifact
 * in HistGradientBoosting's many-tree ensemble, not an export bug, and it
 * never flips a classification at the shipped threshold (0.10). State this
 * honestly in UI copy; never claim exact/byte-identical matching.
 *
 * The algorithm:
 *
 *   for each of 5 CV folds:
 *     p = onnx_fold[i].predict_proba(row)[class 1]      (ColumnTransformer + HGB)
 *     score = ln(p / (1 - p))                            (HGB's decision_function,
 *                                                          derivable exactly from
 *                                                          predict_proba for binary HGB)
 *     calibrated_i = isotonic_interp(clip(score, x_min_i, x_max_i), breakpoints_i)
 *   final_probability = mean(calibrated_i for i in 0..4)
 */
// The default 'onnxruntime-web' entry bundles the JSEP (WebGPU) wasm variant
// (~27MB) even though this app only needs plain CPU inference for a tiny
// ONNX graph. The './wasm' subpath resolves to the CPU-only build (~14MB,
// still large in absolute terms - this is ONNX Runtime Web's actual binary
// size, not a misconfiguration - but real and roughly half the default).
import * as ort from 'onnxruntime-web/wasm'

export interface CustomerFeatures {
  gender: string
  SeniorCitizen: string
  Partner: string
  Dependents: string
  tenure: number
  PhoneService: string
  MultipleLines: string
  InternetService: string
  OnlineSecurity: string
  OnlineBackup: string
  DeviceProtection: string
  TechSupport: string
  StreamingTV: string
  StreamingMovies: string
  Contract: string
  PaperlessBilling: string
  PaymentMethod: string
  MonthlyCharges: number
  TotalCharges: number
}

interface Calibrator {
  fold: number
  x_min: number
  x_max: number
  x: number[]
  y: number[]
}

interface CalibratorsFile {
  threshold: number
  calibrators: Calibrator[]
}

export interface Metadata {
  model_name: string
  feature_order: (keyof CustomerFeatures)[]
  numeric_features: string[]
  categorical_features: string[]
  category_values: Record<string, string[]>
  threshold: number
  n_folds: number
}

let sessions: ort.InferenceSession[] | null = null
let calibratorsData: CalibratorsFile | null = null
let metadata: Metadata | null = null

function clipInterp(x: number, xMin: number, xMax: number, xs: number[], ys: number[]): number {
  const clipped = Math.min(Math.max(x, xMin), xMax)
  if (clipped <= xs[0]) return ys[0]
  if (clipped >= xs[xs.length - 1]) return ys[ys.length - 1]
  // linear interpolation, matching numpy.interp on sorted breakpoints
  let lo = 0
  let hi = xs.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (xs[mid] <= clipped) lo = mid
    else hi = mid
  }
  const t = (clipped - xs[lo]) / (xs[hi] - xs[lo])
  return ys[lo] + t * (ys[hi] - ys[lo])
}

const BASE = import.meta.env.BASE_URL

// onnxruntime-web's own code has a `new URL('ort-wasm-simd-threaded.wasm',
// import.meta.url)` fallback inside its bundle, used only when wasmPaths is
// unset - but Vite's build statically discovers and emits that reference as
// a hashed asset regardless of whether it ever runs, which doubled the
// 14MB binary in dist/ (one copy from that static reference, one from
// public/onnx/). Pointing wasmPaths at the SAME source file via Vite's own
// asset-URL resolution (not a public/ copy) makes both references resolve to
// one deduplicated, content-hashed asset instead of two physical copies.
import wasmUrl from 'onnxruntime-web/ort-wasm-simd-threaded.wasm?url'

export async function loadModel(): Promise<Metadata> {
  if (metadata) return metadata

  ort.env.wasm.wasmPaths = { wasm: wasmUrl }
  // GitHub Pages serves no COOP/COEP headers, so the browser is never
  // cross-origin-isolated and the threaded wasm build silently falls back
  // to 1 thread anyway - but it logs a warning first. Setting this
  // explicitly skips that console noise (see no-critical-console-errors).
  ort.env.wasm.numThreads = 1

  const [metaRes, calRes] = await Promise.all([
    fetch(`${BASE}data/model/metadata.json`),
    fetch(`${BASE}data/model/calibrators.json`),
  ])
  metadata = await metaRes.json()
  calibratorsData = await calRes.json()

  sessions = await Promise.all(
    Array.from({ length: metadata!.n_folds }, (_, i) =>
      ort.InferenceSession.create(`${BASE}data/model/fold_${i}.onnx`)
    )
  )
  return metadata!
}

/** Single-row inference that also returns the 5 per-fold calibrated values, for the inference ledger. */
export async function predictWithFolds(
  customer: CustomerFeatures
): Promise<{ probability: number; folds: number[]; ms: number }> {
  if (!sessions || !calibratorsData || !metadata) {
    throw new Error('loadModel() must resolve before predictWithFolds()')
  }
  const t0 = performance.now()

  const feeds: Record<string, ort.Tensor> = {}
  for (const col of metadata.feature_order) {
    const value = customer[col]
    if (metadata.numeric_features.includes(col as string)) {
      feeds[col as string] = new ort.Tensor('float32', Float32Array.from([Number(value)]), [1, 1])
    } else {
      feeds[col as string] = new ort.Tensor('string', [String(value)], [1, 1])
    }
  }

  const calibratedProbs: number[] = []
  for (let i = 0; i < sessions.length; i++) {
    const output = await sessions[i].run(feeds)
    // skl2onnx Pipeline+Classifier output: 'probabilities' is [1,2] -> [p(class0), p(class1)]
    const probsTensor = output['probabilities']
    const p1 = (probsTensor.data as Float32Array)[1]
    const score = Math.log(p1 / (1 - p1))
    const cal = calibratorsData.calibrators[i]
    calibratedProbs.push(clipInterp(score, cal.x_min, cal.x_max, cal.x, cal.y))
  }
  const probability = calibratedProbs.reduce((a, b) => a + b, 0) / calibratedProbs.length
  return { probability, folds: calibratedProbs, ms: performance.now() - t0 }
}

export async function predictChurnProbability(customer: CustomerFeatures): Promise<number> {
  if (!sessions || !calibratorsData || !metadata) {
    throw new Error('loadModel() must resolve before predictChurnProbability()')
  }

  const feeds: Record<string, ort.Tensor> = {}
  for (const col of metadata.feature_order) {
    const value = customer[col]
    if (metadata.numeric_features.includes(col as string)) {
      feeds[col as string] = new ort.Tensor('float32', Float32Array.from([Number(value)]), [1, 1])
    } else {
      feeds[col as string] = new ort.Tensor('string', [String(value)], [1, 1])
    }
  }

  const calibratedProbs: number[] = []
  for (let i = 0; i < sessions.length; i++) {
    const output = await sessions[i].run(feeds)
    // skl2onnx Pipeline+Classifier output: 'probabilities' is [1,2] -> [p(class0), p(class1)]
    const probsTensor = output['probabilities']
    const p1 = (probsTensor.data as Float32Array)[1]
    const score = Math.log(p1 / (1 - p1))
    const cal = calibratorsData.calibrators[i]
    calibratedProbs.push(clipInterp(score, cal.x_min, cal.x_max, cal.x, cal.y))
  }

  return calibratedProbs.reduce((a, b) => a + b, 0) / calibratedProbs.length
}

/**
 * Batched version of predictChurnProbability: runs N rows through each fold
 * in a single ONNX call (the exported graphs have a dynamic batch dim).
 * Verified in tests/onnx-parity.test.ts that this produces, row for row,
 * the exact same output as calling predictChurnProbability sequentially.
 * Used by the terrain grid (gridWorker.ts) so a 1,536-cell slice is a
 * handful of session.run() calls, not 1,536.
 */
export async function predictBatch(customers: CustomerFeatures[]): Promise<number[]> {
  if (!sessions || !calibratorsData || !metadata) {
    throw new Error('loadModel() must resolve before predictBatch()')
  }
  const n = customers.length
  const feeds: Record<string, ort.Tensor> = {}
  for (const col of metadata.feature_order) {
    if (metadata.numeric_features.includes(col as string)) {
      feeds[col as string] = new ort.Tensor(
        'float32',
        Float32Array.from(customers, (c) => Number(c[col])),
        [n, 1]
      )
    } else {
      feeds[col as string] = new ort.Tensor(
        'string',
        customers.map((c) => String(c[col])),
        [n, 1]
      )
    }
  }

  // [fold][row] calibrated probability
  const perFold: number[][] = []
  for (let i = 0; i < sessions.length; i++) {
    const output = await sessions[i].run(feeds)
    const probs = output['probabilities'].data as Float32Array // [n, 2]
    const cal = calibratorsData.calibrators[i]
    const row: number[] = new Array(n)
    for (let r = 0; r < n; r++) {
      const p1 = probs[r * 2 + 1]
      const score = Math.log(p1 / (1 - p1))
      row[r] = clipInterp(score, cal.x_min, cal.x_max, cal.x, cal.y)
    }
    perFold.push(row)
  }

  const result: number[] = new Array(n)
  for (let r = 0; r < n; r++) {
    let sum = 0
    for (let i = 0; i < perFold.length; i++) sum += perFold[i][r]
    result[r] = sum / perFold.length
  }
  return result
}

export function getThreshold(): number {
  return calibratorsData?.threshold ?? 0.5
}

export function getMetadata(): Metadata | null {
  return metadata
}
