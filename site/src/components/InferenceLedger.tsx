/**
 * Read-only inference ledger (interaction-map.md): real lifecycle state,
 * the 5 per-fold calibrated values and their mean, and timing. Every value
 * here is either LIVE (this inference, mono ivory + live dot) or a
 * lifecycle label - never a placeholder number.
 */
import { useState } from 'react'
import { useAppState } from '../state/store'
import { formatProbability } from '../lib/format'

export default function InferenceLedger({ compact = false }: { compact?: boolean }) {
  const model = useAppState((s) => s.model)
  const pct = useAppState((s) => s.modelLoadPct)
  const error = useAppState((s) => s.modelError)
  const folds = useAppState((s) => s.focalFolds)
  const ms = useAppState((s) => s.focalMs)
  const gridMeta = useAppState((s) => s.gridMeta)
  const [expanded, setExpanded] = useState(false)

  if (model === 'error') {
    return (
      <p className="t-num" style={{ color: 'var(--coral)', maxWidth: '44ch' }} role="alert">
        The in-browser model couldn&rsquo;t start ({error ?? 'unknown error'}). Precomputed predictions for the 400
        real customers still work; editing is disabled.
      </p>
    )
  }

  if (model === 'loading' || model === 'warming') {
    return (
      <p className="t-num" style={{ color: 'var(--gray)' }}>
        model &middot; {model === 'loading' ? `loading ${pct}%` : 'warming'}
      </p>
    )
  }

  return (
    <div className="t-num" style={{ color: 'var(--ivory)' }}>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        style={{ background: 'none', border: 'none', color: 'inherit', font: 'inherit', cursor: 'pointer', padding: 0 }}
        aria-expanded={expanded}
      >
        <span className={`live-dot ${ms != null ? 'pulsing' : ''}`} aria-hidden="true" />
        {compact
          ? `live · 5 folds · ${ms != null ? ms.toFixed(1) : 'n/a'}ms`
          : `rows · 5 folds · ${ms != null ? ms.toFixed(1) : 'n/a'}ms · wasm`}
      </button>
      {expanded && folds && (
        <ul style={{ listStyle: 'none', margin: '6px 0 0', padding: 0, display: 'flex', gap: 10 }}>
          {folds.map((f, i) => (
            <li key={i} className="t-micro">
              fold {i}: {formatProbability(f)}
            </li>
          ))}
        </ul>
      )}
      {gridMeta && (
        <p className="t-micro" data-testid="grid-meta">
          grid {gridMeta.cols}&times;{gridMeta.rows} &middot; {gridMeta.ms.toFixed(1)}ms{gridMeta.coarse ? ' · coarse' : ''}
        </p>
      )}
    </div>
  )
}
