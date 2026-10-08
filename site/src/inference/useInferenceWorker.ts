/**
 * Owns the grid Web Worker from the main thread: starts it once, tracks a
 * monotonically increasing `seq` per request type so a stale result (an
 * older grid/predict request superseded by a newer one) is dropped
 * (interaction-map.md's performance contract), and writes results into the
 * global store.
 */
import { useEffect } from 'react'
import type { CustomerFeatures } from './churnModel'
import type { WorkerRequest, WorkerResponse } from './gridWorker'
import { setModelStatus, setFocalResult, setGridResult, setSensitivityResult, type GridMeta } from '../state/store'
import { FULL_GRID_BUDGET_MS, GRID_RESOLUTION } from '../motion/config'

export interface InferenceWorkerHandle {
  requestPredict: (customer: CustomerFeatures) => void
  requestGrid: (customer: CustomerFeatures, cols: number, rows: number, coarse: boolean) => void
  requestSensitivity: (customer: CustomerFeatures) => void
}

let sharedWorker: Worker | null = null
let gridSeq = 0
let predictSeq = 0
let sensitivitySeq = 0
let latestGridSeq = 0
let latestPredictSeq = 0
let latestSensitivitySeq = 0
let slowGridCount = 0

// `sharedWorker` is already a module-level singleton (one worker for the
// whole app, created lazily on first mount), so the request functions can
// be plain module-level functions too - no need to stash them in a ref
// (which would mean reading `.current` during render, a lint-flagged
// anti-pattern) or in component state.
const handle: InferenceWorkerHandle = {
  requestPredict(customer) {
    if (!sharedWorker) return
    latestPredictSeq = ++predictSeq
    sharedWorker.postMessage({ type: 'predict', seq: latestPredictSeq, customer } satisfies WorkerRequest)
  },
  requestGrid(customer, cols, rows, coarse) {
    if (!sharedWorker) return
    latestGridSeq = ++gridSeq
    sharedWorker.postMessage({ type: 'grid', seq: latestGridSeq, customer, cols, rows } satisfies WorkerRequest)
    void coarse
  },
  requestSensitivity(customer) {
    if (!sharedWorker) return
    latestSensitivitySeq = ++sensitivitySeq
    sharedWorker.postMessage({
      type: 'sensitivity',
      seq: latestSensitivitySeq,
      customer,
    } satisfies WorkerRequest)
  },
}

export function useInferenceWorker(): InferenceWorkerHandle {
  useEffect(() => {
    if (!sharedWorker) {
      sharedWorker = new Worker(new URL('./gridWorker.ts', import.meta.url), { type: 'module' })
      sharedWorker.postMessage({ type: 'load' } satisfies WorkerRequest)
      setModelStatus('loading', 0)
    }
    const worker = sharedWorker

    function onMessage(e: MessageEvent<WorkerResponse>) {
      const msg = e.data
      if (msg.type === 'load-progress') {
        setModelStatus(msg.pct < 100 ? 'loading' : 'warming', msg.pct)
      } else if (msg.type === 'load-done') {
        setModelStatus('ready', 100)
      } else if (msg.type === 'load-error') {
        setModelStatus('error', 0, msg.message)
      } else if (msg.type === 'predict-result') {
        if (msg.seq !== latestPredictSeq) return // stale, drop
        setFocalResult(msg.probability, msg.folds, msg.ms)
      } else if (msg.type === 'grid-result') {
        if (msg.seq !== latestGridSeq) return // stale, drop
        if (msg.ms > FULL_GRID_BUDGET_MS && !gridIsCoarse(msg.cols, msg.rows)) {
          slowGridCount++
        }
        const meta: GridMeta = { cols: msg.cols, rows: msg.rows, ms: msg.ms, coarse: gridIsCoarse(msg.cols, msg.rows) }
        setGridResult(new Float32Array(msg.grid), meta)
      } else if (msg.type === 'sensitivity-result') {
        if (msg.seq !== latestSensitivitySeq) return // stale, drop
        setSensitivityResult(msg.rows)
      }
    }
    worker.addEventListener('message', onMessage)

    return () => {
      worker.removeEventListener('message', onMessage)
    }
  }, [])

  return handle
}

function gridIsCoarse(cols: number, rows: number): boolean {
  return cols <= GRID_RESOLUTION.desktop.coarseCols && rows <= GRID_RESOLUTION.desktop.coarseRows
}

/** If the full grid has blown its 250ms budget twice, callers should downgrade to the adaptive 32x24 default. */
export function shouldDowngradeGrid(): boolean {
  return slowGridCount >= 2
}
