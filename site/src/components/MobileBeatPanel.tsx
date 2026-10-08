/**
 * Mobile's "lower 42svh" content (responsive-spec.md): DOM content that
 * scrolls in the viewport space below the sticky 58svh terrain window. The
 * caller (App.tsx) makes this panel itself `position: sticky` just under
 * the terrain, so it stays on screen for the whole scroll track instead of
 * scrolling away after the first screen - the bug this component exists to
 * fix. Content below the sentence Lab switches on `beatIndex`, replacing
 * the desktop/tablet beats' absolute canvas overlays (SHAP list,
 * "Call it" buttons, contribution ledger), which responsive-spec.md says
 * must never sit over the terrain on mobile.
 */
import { useMemo, useState } from 'react'
import SentenceLab from './SentenceLab'
import CallItButtons from './CallItButtons'
import { ShapPanel, SensitivityPanel } from './ContributionLedger'
import { LENS_ORDER } from '../experiences/BeatFeatures'
import { hasThresholdContour } from '../visualizations/FieldLayer'
import { humanFeatureName, parseShapFeature } from '../data/labels'
import { useAppState, setLens, setFocalCustomer } from '../state/store'
import type { CustomerRow, PredictionRow, GlobalImportance, TopFactor, ModelMetadata } from '../data/fixtures'

function DataCaption({ customers }: { customers: CustomerRow[] }) {
  const stats = useMemo(() => {
    const churned = customers.filter((c) => c.actual_churn === 1).length
    return { n: customers.length, churned, pct: ((churned / customers.length) * 100).toFixed(1) }
  }, [customers])
  return (
    <div style={{ marginBottom: 12 }}>
      <p className="t-h2" style={{ color: 'var(--ivory)' }}>
        Four hundred real customers from the held-out test set.
      </p>
      <p className="t-num" style={{ color: 'var(--gray)', marginTop: 4 }}>
        n={stats.n} of 1,409 &middot; {stats.churned} churned ({stats.pct}%) &middot; full test set 26.5%
      </p>
    </div>
  )
}

function FeatureChipRow({ globalImportance }: { globalImportance: GlobalImportance[] }) {
  const lens = useAppState((s) => s.lens)
  const top8 = globalImportance.slice(0, 8)
  return (
    <div style={{ marginBottom: 12 }}>
      <p className="t-label" style={{ color: 'var(--gray)', marginBottom: 6 }}>
        mean |SHAP| &middot; top 8 of 20
      </p>
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, WebkitOverflowScrolling: 'touch' }}>
        {top8.map((g) => {
          const parsed = parseShapFeature(g.feature)
          const active = parsed.rawFeature === lens
          const selectable = LENS_ORDER.includes(parsed.rawFeature as (typeof LENS_ORDER)[number])
          return (
            <button
              key={g.feature}
              type="button"
              disabled={!selectable}
              onClick={() => setLens(parsed.rawFeature as (typeof LENS_ORDER)[number])}
              className="t-num"
              style={{
                flex: '0 0 auto',
                whiteSpace: 'nowrap',
                background: active ? 'var(--surface-2)' : 'var(--surface-1)',
                color: selectable ? (active ? 'var(--ivory)' : 'var(--gray)') : 'var(--gray-dim)',
                border: active ? '1px solid var(--mint)' : '1px solid var(--line)',
                borderRadius: 2,
                padding: '8px 10px',
                cursor: selectable ? 'pointer' : 'default',
              }}
            >
              {humanFeatureName(parsed.rawFeature)}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function BoundaryCaption({ predictions, grid }: { predictions: PredictionRow[]; grid: Float32Array | null }) {
  const flaggedCount = useMemo(() => predictions.filter((p) => p.churn_probability >= 0.1).length, [predictions])
  const noContour = grid ? !hasThresholdContour(grid) : false
  return (
    <div style={{ marginBottom: 12 }}>
      <p className="t-h2" style={{ color: 'var(--ivory)' }}>
        One number decides: the calibrated probability.
      </p>
      <p className="t-num" style={{ color: 'var(--gray)', marginTop: 4 }}>
        {flaggedCount} of {predictions.length} flagged at 0.10 &middot; cost-optimal (FN $500 &middot; FP $50)
      </p>
      <p className="t-body" style={{ color: 'var(--gray)', marginTop: 4 }}>
        {noContour
          ? 'No 0.10 boundary in this slice: the model flags this profile at every tenure and price shown.'
          : 'Each dot has its own 17 other attributes; the ground only shows this one’s. Pick a customer below to stand on their ground.'}
      </p>
    </div>
  )
}

function ExplanationTabs({
  focal,
  topFactors,
  metadata,
}: {
  focal: CustomerRow
  topFactors: TopFactor[] | null
  metadata: ModelMetadata
}) {
  const edited = useAppState((s) => s.edited)
  const sensitivity = useAppState((s) => s.sensitivity)
  const [tab, setTab] = useState<'shap' | 'sensitivity'>('shap')
  // Editing forces sensitivity (5b replaces 5a, scroll-storyboard.md) - derived
  // during render, not synced via an effect, so there's no cascading re-render.
  const activeTab = edited ? 'sensitivity' : tab

  return (
    <div style={{ marginBottom: 12 }}>
      {edited && (
        <p className="t-body" style={{ color: 'var(--gray)', marginBottom: 8 }}>
          SHAP was precomputed for the original #{focal.id}. You&rsquo;ve changed her, so here is live sensitivity
          instead.{' '}
          <button
            type="button"
            onClick={() => setFocalCustomer(focal)}
            style={{ color: 'var(--mint)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            Restore original
          </button>
        </p>
      )}
      <div role="tablist" aria-label="Explanation view" style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'shap'}
          disabled={edited}
          onClick={() => setTab('shap')}
          className="t-label"
          style={{
            background: activeTab === 'shap' ? 'var(--surface-2)' : 'var(--surface-1)',
            color: edited ? 'var(--gray-dim)' : activeTab === 'shap' ? 'var(--ivory)' : 'var(--gray)',
            border: '1px solid var(--line)',
            padding: '8px 12px',
          }}
        >
          SHAP
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'sensitivity'}
          onClick={() => setTab('sensitivity')}
          className="t-label"
          style={{
            background: activeTab === 'sensitivity' ? 'var(--surface-2)' : 'var(--surface-1)',
            color: activeTab === 'sensitivity' ? 'var(--ivory)' : 'var(--gray)',
            border: '1px solid var(--line)',
            padding: '8px 12px',
          }}
        >
          Sensitivity
        </button>
      </div>
      {activeTab === 'shap' && !edited && topFactors && <ShapPanel topFactors={topFactors} customer={focal} metadata={metadata} />}
      {activeTab === 'sensitivity' && (sensitivity ? <SensitivityPanel rows={sensitivity} /> : <p className="t-micro">computing...</p>)}
    </div>
  )
}

export default function MobileBeatPanel({
  metadata,
  customers,
  predictions,
  globalImportance,
  grid,
  focal,
  topFactors,
}: {
  metadata: ModelMetadata
  customers: CustomerRow[]
  predictions: PredictionRow[]
  globalImportance: GlobalImportance[]
  grid: Float32Array | null
  focal: CustomerRow | undefined
  topFactors: TopFactor[] | null
}) {
  const beatIndex = useAppState((s) => s.beatIndex)

  return (
    <div style={{ padding: 16 }}>
      {beatIndex === 1 && <DataCaption customers={customers} />}
      {beatIndex === 2 && <FeatureChipRow globalImportance={globalImportance} />}
      {beatIndex === 3 && <BoundaryCaption predictions={predictions} grid={grid} />}
      {beatIndex === 4 && (
        <div style={{ marginBottom: 12 }}>
          <CallItButtons focal={focal} />
        </div>
      )}
      {beatIndex === 5 && focal && <ExplanationTabs focal={focal} topFactors={topFactors} metadata={metadata} />}
      <SentenceLab metadata={metadata} />
    </div>
  )
}
