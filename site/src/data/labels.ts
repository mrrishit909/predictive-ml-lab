/**
 * Human-readable labels for raw feature values and SHAP/sensitivity rows.
 * Rules from design/approved/interaction-map.md "SHAP labeling rule".
 */
import type { CustomerFeatures } from '../inference/churnModel'

const HUMAN_FEATURE_NAME: Record<string, string> = {
  tenure: 'Tenure',
  MonthlyCharges: 'Monthly charge',
  TotalCharges: 'Total charges',
  gender: 'Gender',
  SeniorCitizen: 'Senior citizen',
  Partner: 'Partner',
  Dependents: 'Dependents',
  PhoneService: 'Phone service',
  MultipleLines: 'Multiple lines',
  InternetService: 'Internet',
  OnlineSecurity: 'Online security',
  OnlineBackup: 'Online backup',
  DeviceProtection: 'Device protection',
  TechSupport: 'Tech support',
  StreamingTV: 'Streaming TV',
  StreamingMovies: 'Streaming movies',
  Contract: 'Contract',
  PaperlessBilling: 'Paperless billing',
  PaymentMethod: 'Payment method',
}

export function humanFeatureName(raw: string): string {
  return HUMAN_FEATURE_NAME[raw] ?? raw
}

/** Display-only remap, e.g. SeniorCitizen "0"/"1" -> "No"/"Yes". Sent value to the model is unchanged. */
export function displayValue(feature: string, value: string): string {
  if (feature === 'SeniorCitizen') return value === '1' ? 'Yes' : 'No'
  return value
}

export interface ParsedShapFeature {
  kind: 'numeric' | 'categorical'
  rawFeature: string // e.g. "tenure" or "Contract"
  value?: string // for categorical: the one-hot value this column represents
}

/** Parses `num__tenure` or `cat__Contract_Month-to-month` into its parts. */
export function parseShapFeature(encoded: string): ParsedShapFeature {
  if (encoded.startsWith('num__')) {
    return { kind: 'numeric', rawFeature: encoded.slice('num__'.length) }
  }
  const rest = encoded.slice('cat__'.length)
  const underscoreIdx = rest.indexOf('_')
  // feature names never contain '_' themselves (confirmed in metadata.json), so the
  // first underscore always separates the feature from its one-hot value.
  return {
    kind: 'categorical',
    rawFeature: rest.slice(0, underscoreIdx),
    value: rest.slice(underscoreIdx + 1),
  }
}

/**
 * Builds the human label for one SHAP/sensitivity row against the focal
 * customer's actual values, per interaction-map.md's table.
 */
export function shapHumanLabel(encoded: string, customer: CustomerFeatures): string {
  const parsed = parseShapFeature(encoded)
  if (parsed.kind === 'numeric') {
    const value = customer[parsed.rawFeature as keyof CustomerFeatures]
    return `${humanFeatureName(parsed.rawFeature)} = ${value}`
  }
  const actual = String(customer[parsed.rawFeature as keyof CustomerFeatures])
  const name = humanFeatureName(parsed.rawFeature)
  if (parsed.value === actual) {
    return `${name} is ${parsed.value}`
  }
  return `${name} is not ${parsed.value} (is ${actual})`
}
