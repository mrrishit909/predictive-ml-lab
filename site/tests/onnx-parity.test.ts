// @vitest-environment node
//
// onnxruntime-node's native addon checks `instanceof Float32Array` against
// Node's own realm; under the jsdom environment (this project's default,
// for component tests) typed-array globals belong to a different realm and
// that check fails. This test is pure Node/ONNX, no DOM, so it opts back
// into the node environment explicitly.
/**
 * Proves the exported ONNX folds + calibrator JSON, run through the EXACT
 * algorithm churnModel.ts implements, reproduce sklearn's own
 * CalibratedClassifierCV.predict_proba on every real held-out test row
 * (data/model.predictions.json was computed by ml/export_fixtures.py directly
 * from the Python model - this test is the independent, from-scratch
 * re-derivation in TypeScript/onnxruntime, not a copy of that computation).
 *
 * Uses onnxruntime-node (not onnxruntime-web) because this runs under plain
 * Node/Vitest with no browser/WASM-fetch environment; the inference math is
 * identical, only the runtime backend differs. The shipped site uses
 * onnxruntime-web with the same .onnx files and the same algorithm in
 * src/inference/churnModel.ts (predictChurnProbability / predictBatch).
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import * as ort from 'onnxruntime-node'

const DATA_DIR = path.resolve(__dirname, '..', 'public', 'data')
const MODEL_DIR = path.join(DATA_DIR, 'model')

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
interface Metadata {
  feature_order: string[]
  numeric_features: string[]
  n_folds: number
}

function clipInterp(x: number, xMin: number, xMax: number, xs: number[], ys: number[]): number {
  const clipped = Math.min(Math.max(x, xMin), xMax)
  if (clipped <= xs[0]) return ys[0]
  if (clipped >= xs[xs.length - 1]) return ys[ys.length - 1]
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

function buildFeeds(
  metadata: Metadata,
  rows: Record<string, unknown>[]
): Record<string, ort.Tensor> {
  const n = rows.length
  const feeds: Record<string, ort.Tensor> = {}
  for (const col of metadata.feature_order) {
    if (metadata.numeric_features.includes(col)) {
      feeds[col] = new ort.Tensor('float32', Float32Array.from(rows, (r) => Number(r[col])), [n, 1])
    } else {
      feeds[col] = new ort.Tensor('string', rows.map((r) => String(r[col])), [n, 1])
    }
  }
  return feeds
}

describe('ONNX inference parity with sklearn CalibratedClassifierCV', () => {
  const metadata: Metadata = JSON.parse(readFileSync(path.join(MODEL_DIR, 'metadata.json'), 'utf-8'))
  const calibratorsFile: CalibratorsFile = JSON.parse(
    readFileSync(path.join(MODEL_DIR, 'calibrators.json'), 'utf-8')
  )
  const customers = JSON.parse(readFileSync(path.join(DATA_DIR, 'customers.sample.json'), 'utf-8'))
  const predictions = JSON.parse(readFileSync(path.join(DATA_DIR, 'model.predictions.json'), 'utf-8'))
  const threshold = calibratorsFile.threshold

  it('has 5 folds and matching prediction rows for all 400 customers', () => {
    expect(metadata.n_folds).toBe(5)
    expect(customers.length).toBe(400)
    expect(predictions.length).toBe(customers.length)
    for (let i = 0; i < customers.length; i++) {
      expect(predictions[i].id).toBe(customers[i].id)
    }
  })

  it(
    'matches sklearn classification on all 400 held-out rows at threshold 0.10, and the known max deviation (~0.012, 2 rows) never flips one',
    async () => {
      const sessions = await Promise.all(
        Array.from({ length: metadata.n_folds }, (_, i) =>
          ort.InferenceSession.create(path.join(MODEL_DIR, `fold_${i}.onnx`))
        )
      )

      let maxAbsError = 0
      let maxAbsErrorId = -1
      let classificationMismatches = 0

      for (let idx = 0; idx < customers.length; idx++) {
        const customer = customers[idx]
        const expected = predictions[idx].churn_probability as number

        const calibratedProbs: number[] = []
        for (let i = 0; i < sessions.length; i++) {
          const feeds = buildFeeds(metadata, [customer])
          const output = await sessions[i].run(feeds)
          const p1 = (output['probabilities'].data as Float32Array)[1]
          const score = Math.log(p1 / (1 - p1))
          const cal = calibratorsFile.calibrators[i]
          calibratedProbs.push(clipInterp(score, cal.x_min, cal.x_max, cal.x, cal.y))
        }
        const actual = calibratedProbs.reduce((a, b) => a + b, 0) / calibratedProbs.length

        const err = Math.abs(actual - expected)
        if (err > maxAbsError) {
          maxAbsError = err
          maxAbsErrorId = customer.id
        }

        const actualClass = actual >= threshold ? 'Yes' : 'No'
        const expectedClass = expected >= threshold ? 'Yes' : 'No'
        if (actualClass !== expectedClass) classificationMismatches++
      }

      // The documented, investigated artifact: ONNX float32 vs sklearn
      // float64 tree traversal in HistGradientBoosting deviates by up to
      // ~0.012 on 2 of 400 rows. This is reported, not asserted against a
      // tight bound, because it's a known characteristic, not a bug.
      console.log(
        `[onnx-parity] max abs deviation across all 400 rows: ${maxAbsError.toFixed(6)} (customer id ${maxAbsErrorId})`
      )
      expect(maxAbsError).toBeLessThan(0.02) // guards against a real regression, not the known artifact
      expect(classificationMismatches).toBe(0) // the artifact never flips a classification at threshold 0.10
    },
    120_000
  )

  it('produces identical output whether rows are run batched or one at a time', async () => {
    const sessions = await Promise.all(
      Array.from({ length: metadata.n_folds }, (_, i) =>
        ort.InferenceSession.create(path.join(MODEL_DIR, `fold_${i}.onnx`))
      )
    )

    const rows = customers // all 400

    for (let i = 0; i < sessions.length; i++) {
      const batchOutput = await sessions[i].run(buildFeeds(metadata, rows))
      const batchProbs = batchOutput['probabilities'].data as Float32Array // [400, 2]

      // Sequential single-row calls for a deterministic spread of rows
      // (every 37th) - full 400x5 sequential is already covered above.
      for (let idx = 0; idx < rows.length; idx += 37) {
        const singleOutput = await sessions[i].run(buildFeeds(metadata, [rows[idx]]))
        const singleP1 = (singleOutput['probabilities'].data as Float32Array)[1]
        const batchP1 = batchProbs[idx * 2 + 1]
        expect(batchP1).toBeCloseTo(singleP1, 6)
      }
    }
  }, 60_000)
})
