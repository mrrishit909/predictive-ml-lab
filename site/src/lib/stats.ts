/**
 * DERIVED-class computations (art-direction.md's provenance table): real
 * math over the real 400-row fixture sample, computed in the browser at
 * runtime, labeled "sample n=400" wherever shown. Never the held-out
 * numbers, which come only from model.metrics.json.
 */
import type { PredictionRow } from '../data/fixtures'

export interface ConfusionCounts {
  tp: number
  fp: number
  fn: number
  tn: number
}

export function confusionAt(predictions: PredictionRow[], threshold: number): ConfusionCounts {
  let tp = 0,
    fp = 0,
    fn = 0,
    tn = 0
  for (const row of predictions) {
    const predicted = row.churn_probability >= threshold
    const actual = row.actual_churn === 1
    if (predicted && actual) tp++
    else if (predicted && !actual) fp++
    else if (!predicted && actual) fn++
    else tn++
  }
  return { tp, fp, fn, tn }
}

export interface RocPoint {
  fpr: number
  tpr: number
  threshold: number
}

/**
 * ROC curve + trapezoidal AUC from the 400-row sample, sorted by
 * probability descending. Isotonic calibration produces exact ties
 * (identical churn_probability on many rows); every row at the same
 * probability is grouped into one ROC step, not walked one at a time.
 * Breaking ties into separate steps always understates the AUC (a
 * staircase of small orthogonal steps covers less area than the single
 * diagonal step connecting the same two corners), which is the actual
 * reason an earlier, ungrouped version of this function measured 0.855
 * against the spec's measured 0.854.
 */
export function rocFromSample(predictions: PredictionRow[]): { points: RocPoint[]; auc: number } {
  const sorted = [...predictions].sort((a, b) => b.churn_probability - a.churn_probability)
  const totalPos = sorted.filter((r) => r.actual_churn === 1).length
  const totalNeg = sorted.length - totalPos
  const points: RocPoint[] = [{ fpr: 0, tpr: 0, threshold: 1 }]
  let tp = 0
  let fp = 0
  let i = 0
  while (i < sorted.length) {
    const p = sorted[i].churn_probability
    let j = i
    while (j < sorted.length && sorted[j].churn_probability === p) {
      if (sorted[j].actual_churn === 1) tp++
      else fp++
      j++
    }
    points.push({ fpr: totalNeg ? fp / totalNeg : 0, tpr: totalPos ? tp / totalPos : 0, threshold: p })
    i = j
  }
  let auc = 0
  for (let k = 1; k < points.length; k++) {
    const dx = points[k].fpr - points[k - 1].fpr
    auc += (dx * (points[k].tpr + points[k - 1].tpr)) / 2
  }
  return { points, auc }
}

export interface ReliabilityBin {
  meanPredicted: number
  observedRate: number
  n: number
}

/**
 * Quantile-binned reliability diagram (~8 bins of ~50 rows each). Isotonic
 * calibration produces plateaus - runs of many rows sharing one exact
 * probability - and a tied run is never split across two bins: once a bin
 * reaches its target size, it still absorbs the rest of the current tie
 * before closing, so every bin's n is the real count, not a fixed slice
 * size that could cut a tie in half.
 */
export function reliabilityBins(predictions: PredictionRow[], numBins = 8): ReliabilityBin[] {
  const sorted = [...predictions].sort((a, b) => a.churn_probability - b.churn_probability)
  const n = sorted.length
  const targetSize = n / numBins
  const bins: ReliabilityBin[] = []
  let i = 0
  while (i < n) {
    let j = Math.min(n, i + Math.round(targetSize))
    // extend to absorb the rest of a tie straddling the boundary
    while (j < n && sorted[j].churn_probability === sorted[j - 1].churn_probability) j++
    const slice = sorted.slice(i, j)
    const meanPredicted = slice.reduce((a, r) => a + r.churn_probability, 0) / slice.length
    const observedRate = slice.reduce((a, r) => a + r.actual_churn, 0) / slice.length
    bins.push({ meanPredicted, observedRate, n: slice.length })
    i = j
  }
  return bins
}
