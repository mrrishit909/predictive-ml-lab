/**
 * Loads the real fixture JSONs (site/public/data/*) once at page load and
 * caches them. These are read-only, real, measured artifacts - never
 * regenerated or mutated by the site. See design/approved/art-direction.md's
 * provenance table: everything here is class FIXTURE.
 */
import type { CustomerFeatures } from '../inference/churnModel'

export interface CustomerRow extends CustomerFeatures {
  id: number
  actual_churn: 0 | 1
}

export interface PredictionRow {
  id: number
  churn_probability: number
  churn_prediction: 'Yes' | 'No'
  actual_churn: 0 | 1
}

export interface ModelResult {
  model: string
  roc_auc: number
  pr_auc: number
  precision: number
  recall: number
  f1: number
  brier_score: number
  confusion_matrix: { tn: number; fp: number; fn: number; tp: number }
  cv_roc_auc_mean?: number
  cv_roc_auc_std?: number
}

export interface MetricsFile {
  best_model: string
  results: ModelResult[]
  cost_threshold_metrics: {
    threshold: number
    cost_false_negative: number
    cost_false_positive: number
    precision: number
    recall: number
    f1: number
    confusion_matrix: { tn: number; fp: number; fn: number; tp: number }
  }
}

export interface GlobalImportance {
  feature: string
  mean_abs_impact: number
}

export interface TopFactor {
  feature: string
  shap_value: number
}

export interface ExplanationsFile {
  space: string
  global: GlobalImportance[]
  per_row: { id: number; top_factors: TopFactor[] }[]
}

export interface Fixtures {
  customers: CustomerRow[]
  predictions: PredictionRow[]
  metrics: MetricsFile
  explanations: ExplanationsFile
}

let cached: Promise<Fixtures> | null = null

const BASE = import.meta.env.BASE_URL

export function loadFixtures(): Promise<Fixtures> {
  if (cached) return cached
  cached = Promise.all([
    fetch(`${BASE}data/customers.sample.json`).then((r) => r.json()),
    fetch(`${BASE}data/model.predictions.json`).then((r) => r.json()),
    fetch(`${BASE}data/model.metrics.json`).then((r) => r.json()),
    fetch(`${BASE}data/feature.explanations.json`).then((r) => r.json()),
  ]).then(([customers, predictions, metrics, explanations]) => ({
    customers,
    predictions,
    metrics,
    explanations,
  }))
  return cached
}

export function joinCustomerPrediction(
  f: Fixtures,
  id: number
): { customer: CustomerRow; prediction: PredictionRow } | null {
  const customer = f.customers.find((c) => c.id === id)
  const prediction = f.predictions.find((p) => p.id === id)
  if (!customer || !prediction) return null
  return { customer, prediction }
}

export function topFactorsFor(f: Fixtures, id: number): TopFactor[] | null {
  return f.explanations.per_row.find((r) => r.id === id)?.top_factors ?? null
}

/** The default focal customer per art-direction.md: #276. */
export const DEFAULT_FOCAL_ID = 276

export interface ModelMetadata {
  feature_order: (keyof CustomerFeatures)[]
  numeric_features: string[]
  categorical_features: string[]
  category_values: Record<string, string[]>
  threshold: number
  n_folds: number
}

let metadataCache: Promise<ModelMetadata> | null = null

/**
 * The 19-feature schema (category_values etc) is needed on the main thread
 * to build the Prediction Lab's controls, independent of model inference
 * (which runs inside gridWorker.ts, a separate module instance). This is a
 * second, tiny (~2KB) fetch of the same metadata.json, not model loading.
 */
export function loadMetadata(): Promise<ModelMetadata> {
  if (metadataCache) return metadataCache
  metadataCache = fetch(`${BASE}data/model/metadata.json`).then((r) => r.json())
  return metadataCache
}
