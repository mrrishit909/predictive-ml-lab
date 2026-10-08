/**
 * Single global store for the whole experience, per
 * design/approved/interaction-map.md "Global state (one store)".
 *
 * Implemented on useSyncExternalStore (built into React 19) rather than a
 * state-management dependency: this is a flat object with ~15 fields and a
 * handful of actions, which doesn't earn Redux/Zustand/Jotai.
 */
import { useSyncExternalStore } from 'react'
import type { CustomerFeatures } from '../inference/churnModel'
import type { SensitivityRow } from '../inference/gridWorker'
import { applyFeatureChange, deriveTotalCharges } from '../data/constraints'
import type { CustomerRow } from '../data/fixtures'

export type ModelLifecycle = 'loading' | 'warming' | 'ready' | 'error'

export type FeatureLens = 'none' | 'Contract' | 'tenure' | 'InternetService'

export interface GridMeta {
  cols: number
  rows: number
  ms: number
  coarse: boolean
}

export interface AppState {
  focalId: number
  features: CustomerFeatures | null
  shadow: Partial<CustomerFeatures>
  edited: boolean
  totalChargesLinked: boolean
  threshold: number
  model: ModelLifecycle
  modelLoadPct: number
  modelError: string | null
  focalP: number | null
  focalFolds: number[] | null
  focalMs: number | null
  grid: Float32Array | null
  gridMeta: GridMeta | null
  beatIndex: number
  beatProgress: number
  lens: FeatureLens
  evalThreshold: number
  introSeen: boolean
  callItAnswered: 'Stayed' | 'Left' | 'skip' | null
  restoredFromId: number | null // for the "edited" -> SHAP-restore link in beat 5
  sensitivity: SensitivityRow[] | null
}

type Listener = () => void

const listeners = new Set<Listener>()

let state: AppState = {
  focalId: 276,
  features: null,
  shadow: {},
  edited: false,
  totalChargesLinked: true,
  threshold: 0.1,
  model: 'loading',
  modelLoadPct: 0,
  modelError: null,
  focalP: null,
  focalFolds: null,
  focalMs: null,
  grid: null,
  gridMeta: null,
  beatIndex: 0,
  beatProgress: 0,
  lens: 'none',
  evalThreshold: 0.1,
  introSeen: false,
  callItAnswered: null,
  restoredFromId: null,
  sensitivity: null,
}

function emit() {
  for (const l of listeners) l()
}

function set(patch: Partial<AppState>) {
  state = { ...state, ...patch }
  emit()
}

export function getState(): AppState {
  return state
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useAppState<T>(selector: (s: AppState) => T): T {
  return useSyncExternalStore(subscribe, () => selector(state))
}

// ---------------- actions ----------------

export function setFocalCustomer(row: CustomerRow) {
  const { id, actual_churn, ...features } = row
  void actual_churn
  set({
    focalId: id,
    features: features as CustomerFeatures,
    shadow: {},
    edited: false,
    restoredFromId: null,
    sensitivity: null,
  })
}

export function setSensitivityResult(rows: SensitivityRow[]) {
  set({ sensitivity: rows })
}

export function updateFeature(key: keyof CustomerFeatures, value: string | number) {
  if (!state.features) return
  const { features, shadow } = applyFeatureChange(state.features, state.shadow, key, value)
  if (state.totalChargesLinked && (key === 'tenure' || key === 'MonthlyCharges')) {
    features.TotalCharges = deriveTotalCharges(features.tenure, features.MonthlyCharges)
  }
  set({ features, shadow, edited: true })
}

export function setTotalChargesLinked(linked: boolean) {
  if (!state.features) return
  if (linked) {
    const TotalCharges = deriveTotalCharges(state.features.tenure, state.features.MonthlyCharges)
    set({ totalChargesLinked: true, features: { ...state.features, TotalCharges } })
  } else {
    set({ totalChargesLinked: false })
  }
}

export function resetFeatures(customers: CustomerRow[]) {
  const row = customers.find((c) => c.id === state.focalId)
  if (row) setFocalCustomer(row)
}

export function setModelStatus(model: ModelLifecycle, pct = 0, error: string | null = null) {
  set({ model, modelLoadPct: pct, modelError: error })
}

export function setFocalResult(p: number, folds: number[], ms: number) {
  set({ focalP: p, focalFolds: folds, focalMs: ms })
}

export function setGridResult(grid: Float32Array, meta: GridMeta) {
  set({ grid, gridMeta: meta })
}

export function setBeat(beatIndex: number, beatProgress: number) {
  if (state.beatIndex === beatIndex && state.beatProgress === beatProgress) return
  set({ beatIndex, beatProgress })
}

export function setLens(lens: FeatureLens) {
  set({ lens })
}

export function setEvalThreshold(threshold: number) {
  set({ evalThreshold: threshold })
}

export function markIntroSeen() {
  try {
    sessionStorage.setItem('predictive.introSeen', '1')
  } catch {
    /* storage blocked - intro just won't auto-skip on return visits */
  }
  set({ introSeen: true })
}

export function readIntroSeen(): boolean {
  try {
    return sessionStorage.getItem('predictive.introSeen') === '1'
  } catch {
    return false
  }
}

export function setCallItAnswered(answer: 'Stayed' | 'Left' | 'skip') {
  set({ callItAnswered: answer })
}
