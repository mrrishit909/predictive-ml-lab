/**
 * Feature validity rules that mirror the training data, per
 * design/approved/interaction-map.md "Feature constraints". Invalid
 * combinations (e.g. OnlineSecurity set while InternetService="No") must
 * never reach the model.
 */
import type { CustomerFeatures } from '../inference/churnModel'

export const INTERNET_DEPENDENT_FEATURES = [
  'OnlineSecurity',
  'OnlineBackup',
  'DeviceProtection',
  'TechSupport',
  'StreamingTV',
  'StreamingMovies',
] as const

// dataset-measured ranges (data/raw/Telco-Customer-Churn.csv), also used by composition.md's plot geometry.
export const TENURE_RANGE = { min: 0, max: 72 }
export const MONTHLY_CHARGES_RANGE = { min: 18.25, max: 118.75 }
export const TOTAL_CHARGES_RANGE = { min: 18.8, max: 8684.8 }

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v))
}

export interface ConstraintResult {
  features: CustomerFeatures
  /** values forced off by a rule, remembered so they can be restored (e.g. re-enabling internet). */
  shadow: Partial<CustomerFeatures>
}

/**
 * Applies one feature change plus the dependency rules, returning the new
 * feature set and an updated shadow of "last real value before it was
 * forced off" for restoring dependent controls later.
 */
export function applyFeatureChange(
  features: CustomerFeatures,
  shadow: Partial<CustomerFeatures>,
  key: keyof CustomerFeatures,
  rawValue: string | number
): ConstraintResult {
  const next: CustomerFeatures = { ...features }
  const nextShadow: Partial<CustomerFeatures> = { ...shadow }

  if (key === 'tenure') {
    next.tenure = clamp(Math.round(Number(rawValue)), TENURE_RANGE.min, TENURE_RANGE.max)
  } else if (key === 'MonthlyCharges') {
    next.MonthlyCharges = clamp(Number(rawValue), MONTHLY_CHARGES_RANGE.min, MONTHLY_CHARGES_RANGE.max)
  } else if (key === 'TotalCharges') {
    next.TotalCharges = clamp(Number(rawValue), 0, Infinity)
  } else {
    ;(next as unknown as Record<string, unknown>)[key] = String(rawValue)
  }

  if (key === 'InternetService') {
    if (next.InternetService === 'No') {
      for (const f of INTERNET_DEPENDENT_FEATURES) {
        nextShadow[f] = features[f] // remember current value
        next[f] = 'No internet service'
      }
    } else if (features.InternetService === 'No') {
      // restoring from "No": bring back shadowed values, default "No"
      for (const f of INTERNET_DEPENDENT_FEATURES) {
        next[f] = (nextShadow[f] as string) ?? 'No'
      }
    }
  }

  if (key === 'PhoneService') {
    if (next.PhoneService === 'No') {
      nextShadow.MultipleLines = features.MultipleLines
      next.MultipleLines = 'No phone service'
    } else if (features.PhoneService === 'No') {
      next.MultipleLines = (nextShadow.MultipleLines as string) ?? 'No'
    }
  }

  return { features: next, shadow: nextShadow }
}

/** TotalCharges = round(tenure * MonthlyCharges, 2), per the linked-by-default rule. */
export function deriveTotalCharges(tenure: number, monthlyCharges: number): number {
  return Math.round(tenure * monthlyCharges * 100) / 100
}

export function isControlDisabled(features: CustomerFeatures, key: keyof CustomerFeatures): boolean {
  if ((INTERNET_DEPENDENT_FEATURES as readonly string[]).includes(key as string)) {
    return features.InternetService === 'No'
  }
  if (key === 'MultipleLines') return features.PhoneService === 'No'
  return false
}
