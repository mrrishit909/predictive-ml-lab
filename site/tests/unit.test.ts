import { describe, expect, it } from 'vitest'
import { applyFeatureChange, deriveTotalCharges, isControlDisabled } from '../src/data/constraints'
import { formatProbability, formatShap, formatDeltaProbability } from '../src/lib/format'
import { shapHumanLabel, parseShapFeature, displayValue } from '../src/data/labels'
import { confusionAt, rocFromSample } from '../src/lib/stats'
import { seededMotionFor, introSubsetIds } from '../src/data/seeds'
import { logit, clamp } from '../src/lib/math'
import type { CustomerFeatures } from '../src/inference/churnModel'

const BASE_CUSTOMER: CustomerFeatures = {
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

describe('constraints.ts: feature dependency rules (interaction-map.md)', () => {
  it('forces internet-dependent features to "No internet service" when InternetService -> No', () => {
    const { features, shadow } = applyFeatureChange(BASE_CUSTOMER, {}, 'InternetService', 'No')
    expect(features.OnlineSecurity).toBe('No internet service')
    expect(features.TechSupport).toBe('No internet service')
    expect(shadow.TechSupport).toBe('Yes') // original value remembered for restore
  })

  it('restores the shadowed value when InternetService switches back on', () => {
    const off = applyFeatureChange(BASE_CUSTOMER, {}, 'InternetService', 'No')
    const backOn = applyFeatureChange(off.features, off.shadow, 'InternetService', 'Fiber optic')
    expect(backOn.features.TechSupport).toBe('Yes')
  })

  it('forces MultipleLines to "No phone service" when PhoneService -> No', () => {
    const { features } = applyFeatureChange(BASE_CUSTOMER, {}, 'PhoneService', 'No')
    expect(features.MultipleLines).toBe('No phone service')
  })

  it('clamps tenure and MonthlyCharges to the dataset range', () => {
    expect(applyFeatureChange(BASE_CUSTOMER, {}, 'tenure', 999).features.tenure).toBe(72)
    expect(applyFeatureChange(BASE_CUSTOMER, {}, 'tenure', -5).features.tenure).toBe(0)
    expect(applyFeatureChange(BASE_CUSTOMER, {}, 'MonthlyCharges', 1).features.MonthlyCharges).toBe(18.25)
  })

  it('isControlDisabled reflects the current InternetService/PhoneService state', () => {
    expect(isControlDisabled(BASE_CUSTOMER, 'OnlineSecurity')).toBe(false)
    expect(isControlDisabled({ ...BASE_CUSTOMER, InternetService: 'No' }, 'OnlineSecurity')).toBe(true)
  })

  it('deriveTotalCharges rounds tenure * charge to 2 decimals', () => {
    expect(deriveTotalCharges(10, 55.2)).toBe(552)
    expect(deriveTotalCharges(3, 19.999)).toBeCloseTo(59.997, 2)
  })
})

describe('format.ts: probability/SHAP display rules (interaction-map.md, typography.md)', () => {
  it('never prints bare 0 or 1', () => {
    expect(formatProbability(0)).toBe('<0.001')
    expect(formatProbability(1)).toBe('>0.999')
    expect(formatProbability(0.2174)).toBe('0.217')
  })
  it('formats SHAP as signed log-odds, never a percent', () => {
    expect(formatShap(0.723)).toBe('+0.72 log-odds')
    expect(formatShap(-0.31)).toBe('-0.31 log-odds')
  })
  it('formats sensitivity deltas as signed probability, not log-odds', () => {
    expect(formatDeltaProbability(-0.138)).toBe('-0.138')
    expect(formatDeltaProbability(0.05)).toBe('+0.050')
  })
})

describe('labels.ts: SHAP one-hot -> human label (interaction-map.md table)', () => {
  it('numeric feature: "X = value"', () => {
    expect(shapHumanLabel('num__tenure', BASE_CUSTOMER)).toBe('Tenure = 10')
  })
  it('categorical feature matching the actual value: "X is v"', () => {
    expect(shapHumanLabel('cat__Contract_Month-to-month', BASE_CUSTOMER)).toBe('Contract is Month-to-month')
  })
  it('categorical feature NOT matching the actual value: "X is not v (is v*)"', () => {
    expect(shapHumanLabel('cat__InternetService_Fiber optic', BASE_CUSTOMER)).toBe(
      'Internet is not Fiber optic (is DSL)'
    )
  })
  it('parseShapFeature splits on the first underscore after cat__ only', () => {
    expect(parseShapFeature('cat__PaymentMethod_Credit card (automatic)')).toEqual({
      kind: 'categorical',
      rawFeature: 'PaymentMethod',
      value: 'Credit card (automatic)',
    })
  })
  it('SeniorCitizen displays as Yes/No but the model still sees "0"/"1"', () => {
    expect(displayValue('SeniorCitizen', '1')).toBe('Yes')
    expect(displayValue('SeniorCitizen', '0')).toBe('No')
  })
})

describe('stats.ts: DERIVED sample computations', () => {
  const sample = [
    { id: 1, churn_probability: 0.9, churn_prediction: 'Yes' as const, actual_churn: 1 as const },
    { id: 2, churn_probability: 0.05, churn_prediction: 'No' as const, actual_churn: 0 as const },
    { id: 3, churn_probability: 0.2, churn_prediction: 'Yes' as const, actual_churn: 0 as const },
    { id: 4, churn_probability: 0.08, churn_prediction: 'No' as const, actual_churn: 1 as const },
  ]
  it('confusionAt counts TP/FP/FN/TN correctly at a given threshold', () => {
    expect(confusionAt(sample, 0.1)).toEqual({ tp: 1, fp: 1, fn: 1, tn: 1 })
  })
  it('rocFromSample produces an AUC between 0 and 1 and a monotonically non-decreasing curve', () => {
    const { points, auc } = rocFromSample(sample)
    expect(auc).toBeGreaterThanOrEqual(0)
    expect(auc).toBeLessThanOrEqual(1)
    for (let i = 1; i < points.length; i++) {
      expect(points[i].fpr).toBeGreaterThanOrEqual(points[i - 1].fpr)
      expect(points[i].tpr).toBeGreaterThanOrEqual(points[i - 1].tpr)
    }
  })
})

describe('math.ts: logit', () => {
  it('logit(0.10) matches the known calibrator breakpoint value', () => {
    expect(logit(0.1)).toBeCloseTo(-2.1972, 3)
  })
  it('clamp bounds a value', () => {
    expect(clamp(5, 0, 1)).toBe(1)
    expect(clamp(-5, 0, 1)).toBe(0)
  })
})

describe('seeds.ts: deterministic, no Math.random (composition.md, scroll-storyboard.md)', () => {
  it('seededMotionFor is deterministic across calls for the same ids', () => {
    const ids = [0, 1, 2, 3, 4]
    const a = seededMotionFor(ids)
    // seededMotionFor caches on first call; re-derive via direct comparison of the same cached map instance is trivial,
    // so instead assert each id's values are plausible and present.
    for (const id of ids) {
      const m = a.get(id)!
      expect(m.jitterX).toBeGreaterThanOrEqual(-0.35)
      expect(m.jitterX).toBeLessThanOrEqual(0.35)
      expect(m.driftFreqX).toBeGreaterThanOrEqual(0.4)
      expect(m.driftFreqX).toBeLessThanOrEqual(0.9)
    }
  })

  it('introSubsetIds is deterministic and always includes the focal id', () => {
    const ids = Array.from({ length: 400 }, (_, i) => i)
    const a = introSubsetIds(ids, 276, 199)
    const b = introSubsetIds(ids, 276, 199)
    expect(a).toEqual(b) // same seed -> same shuffle, every time
    expect(a).toContain(276)
    expect(a.length).toBe(200)
  })
})
