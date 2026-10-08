/**
 * Beat 5 Explainability: SHAP (genuine, precomputed) vs live sensitivity
 * (real ONNX perturbation), visually and textually distinct per
 * art-direction.md / scroll-storyboard.md "5a/5b". SHAP bars are solid;
 * sensitivity bars are 45deg-hatched. Never the same look.
 */
import { useMemo } from 'react'
import type { TopFactor } from '../data/fixtures'
import type { SensitivityRow } from '../inference/gridWorker'
import type { CustomerFeatures } from '../inference/churnModel'
import { shapHumanLabel, humanFeatureName } from '../data/labels'
import { formatShap, formatDeltaProbability } from '../lib/format'
import { updateFeature, setFocalCustomer } from '../state/store'
import type { CustomerRow, ModelMetadata } from '../data/fixtures'

function Bar({ value, max, solid, label, sub, onClick }: { value: number; max: number; solid: boolean; label: string; sub: string; onClick?: () => void }) {
  const widthPct = (Math.abs(value) / max) * 50
  const positive = value >= 0
  const color = positive ? 'var(--coral)' : 'var(--mint)'
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      onClick={onClick}
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        alignItems: 'center',
        width: '100%',
        background: 'none',
        border: 'none',
        padding: '4px 0',
        cursor: onClick ? 'pointer' : 'default',
        textAlign: 'left',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'flex-end', position: 'relative', height: 14 }}>
        {!positive && (
          <div
            style={{
              width: `${widthPct}%`,
              height: 14,
              background: solid ? color : 'transparent',
              border: solid ? 'none' : `1px solid ${color}`,
              backgroundImage: solid ? undefined : hatch(color),
            }}
          />
        )}
      </div>
      <div style={{ display: 'flex' }}>
        {positive && (
          <div
            style={{
              width: `${widthPct}%`,
              height: 14,
              background: solid ? color : 'transparent',
              border: solid ? 'none' : `1px solid ${color}`,
              backgroundImage: solid ? undefined : hatch(color),
            }}
          />
        )}
      </div>
      <div style={{ gridColumn: '1 / 3', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <span className="t-num" style={{ color: 'var(--ivory)' }}>
          {label}
        </span>
        <span className="t-micro">{sub}</span>
      </div>
    </Tag>
  )
}

function hatch(color: string): string {
  return `repeating-linear-gradient(45deg, ${color} 0, ${color} 2px, transparent 2px, transparent 6px)`
}

/** 3 numeric + every one-hot column skl2onnx actually encodes - computed here, not hardcoded. */
export function encodedFeatureCount(metadata: ModelMetadata): number {
  const oneHot = Object.values(metadata.category_values).reduce((sum, values) => sum + values.length, 0)
  return metadata.numeric_features.length + oneHot
}

export function ShapPanel({
  topFactors,
  customer,
  metadata,
}: {
  topFactors: TopFactor[]
  customer: CustomerFeatures
  metadata: ModelMetadata
}) {
  const max = useMemo(() => Math.max(...topFactors.map((f) => Math.abs(f.shap_value)), 0.01), [topFactors])
  const total = encodedFeatureCount(metadata)
  return (
    <div data-testid="shap-panel">
      <p className="t-label" style={{ color: 'var(--gray)' }}>
        SHAP &middot; log-odds &middot; HGB base model &middot; not the calibrated probability &middot; top 8 of{' '}
        {total} encoded features
      </p>
      {topFactors.map((f) => (
        <Bar
          key={f.feature}
          value={f.shap_value}
          max={max}
          solid
          label={shapHumanLabel(f.feature, customer)}
          sub={formatShap(f.shap_value)}
        />
      ))}
      <p className="t-micro" style={{ color: 'var(--gray)', marginTop: 8 }}>
        remaining {total - topFactors.length} encoded features &middot; not stored in fixture
      </p>
    </div>
  )
}

export function SensitivityPanel({ rows, allRow }: { rows: SensitivityRow[]; allRow?: boolean }) {
  const byFeature = useMemo(() => {
    const groups = new Map<string, SensitivityRow>()
    for (const r of rows) {
      const existing = groups.get(r.feature)
      if (!existing || Math.abs(r.deltaP) > Math.abs(existing.deltaP)) groups.set(r.feature, r)
    }
    return Array.from(groups.values()).sort((a, b) => Math.abs(b.deltaP) - Math.abs(a.deltaP)).slice(0, allRow ? 19 : 8)
  }, [rows, allRow])
  const max = useMemo(() => Math.max(...byFeature.map((f) => Math.abs(f.deltaP)), 0.001), [byFeature])

  return (
    <div data-testid="sensitivity-panel">
      <p className="t-label" style={{ color: 'var(--gray)' }}>
        live sensitivity &middot; exact &Delta; calibrated probability per single switch &middot; not SHAP
      </p>
      {byFeature.map((r) => (
        <Bar
          key={r.feature}
          value={r.deltaP}
          max={max}
          solid={false}
          label={`${humanFeatureName(r.feature)} → ${r.toValue}`}
          sub={formatDeltaProbability(r.deltaP)}
          onClick={() => updateFeature(r.feature as keyof CustomerFeatures, r.toValue)}
        />
      ))}
    </div>
  )
}

export default function ContributionLedger({
  focal,
  topFactors,
  sensitivity,
  edited,
  metadata,
}: {
  focal: CustomerRow
  topFactors: TopFactor[] | null
  sensitivity: SensitivityRow[] | null
  edited: boolean
  metadata: ModelMetadata
}) {
  return (
    <div style={{ background: 'var(--surface-1)', padding: 16, maxWidth: 480 }}>
      {edited ? (
        <>
          <p className="t-body" style={{ color: 'var(--gray)', marginBottom: 8 }}>
            SHAP was precomputed for the original #{focal.id}. You&rsquo;ve changed her, so here is what the live
            model says instead.{' '}
            <button type="button" onClick={() => setFocalCustomer(focal)} style={{ color: 'var(--mint)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              Restore original
            </button>
          </p>
          {sensitivity ? <SensitivityPanel rows={sensitivity} /> : <p className="t-micro">computing...</p>}
        </>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {topFactors && <ShapPanel topFactors={topFactors} customer={focal} metadata={metadata} />}
          {sensitivity && <SensitivityPanel rows={sensitivity} />}
        </div>
      )}
    </div>
  )
}
