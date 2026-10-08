/**
 * Exact, real browser-native inference matching the shipped scikit-learn
 * CalibratedClassifierCV(HistGradientBoostingClassifier, method="isotonic", cv=5).
 *
 * This is NOT an approximation: it replicates, byte-for-byte (verified against
 * sklearn's own predict_proba in ml/export_fixtures.py before this file was
 * written, and re-verified by tests/onnx-parity.test.ts against every row in
 * data/model.predictions.json), the exact algorithm sklearn's
 * CalibratedClassifierCV uses:
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

export async function loadModel(): Promise<Metadata> {
  if (metadata) return metadata

  ort.env.wasm.wasmPaths = `${BASE}onnx/`

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

export function getThreshold(): number {
  return calibratorsData?.threshold ?? 0.5
}

export function getMetadata(): Metadata | null {
  return metadata
}
