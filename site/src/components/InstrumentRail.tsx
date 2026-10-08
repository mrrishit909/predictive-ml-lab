/**
 * Desktop: right-edge vertical rail, 20px collapsed / 320px expanded
 * (interaction-map.md, responsive-spec.md). Tablet: bottom dock with 4 key
 * controls, "L" expands to the full sheet. Mobile uses SentenceLab instead
 * (rendered by the caller) - a genuinely different interaction, not a CSS
 * reflow of this component.
 */
import { useState, useEffect } from 'react'
import FeatureControls from './FeatureControls'
import InferenceLedger from './InferenceLedger'
import { useAppState, resetFeatures } from '../state/store'
import type { ModelMetadata, CustomerRow } from '../data/fixtures'
import { formatProbability } from '../lib/format'

export default function InstrumentRail({
  metadata,
  customers,
  pinned = false,
  layout = 'rail',
}: {
  metadata: ModelMetadata
  customers: CustomerRow[]
  pinned?: boolean
  layout: 'rail' | 'dock'
}) {
  const [expanded, setExpanded] = useState(pinned)
  const focalP = useAppState((s) => s.focalP)
  const edited = useAppState((s) => s.edited)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key.toLowerCase() === 'l' && !(e.target instanceof HTMLInputElement)) setExpanded((v) => !v)
      if (e.key.toLowerCase() === 'r' && !(e.target instanceof HTMLInputElement)) resetFeatures(customers)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [customers])

  const open = expanded || pinned

  if (layout === 'dock') {
    return (
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          background: 'var(--surface-1)',
          borderTop: '1px solid var(--line)',
          padding: 12,
          maxHeight: open ? '60svh' : 96,
          overflowY: open ? 'auto' : 'hidden',
          transition: 'max-height 360ms cubic-bezier(0.65,0,0.35,1)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="t-num-hero" style={{ fontSize: 32 }}>
            {focalP != null ? formatProbability(focalP) : '...'}
          </span>
          <InferenceLedger compact />
          <button type="button" onClick={() => setExpanded((v) => !v)} className="t-label">
            {open ? 'Collapse' : 'All 19 features'}
          </button>
        </div>
        {open && (
          <div style={{ marginTop: 12 }}>
            <FeatureControls metadata={metadata} />
            {edited && (
              <button type="button" onClick={() => resetFeatures(customers)} className="t-label" style={{ marginTop: 12 }}>
                Reset
              </button>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      onMouseEnter={() => !pinned && setExpanded(true)}
      onMouseLeave={() => !pinned && setExpanded(false)}
      onFocus={() => setExpanded(true)}
      style={{
        position: 'absolute',
        right: 0,
        top: 0,
        bottom: 0,
        width: open ? 320 : 20,
        background: 'var(--surface-1)',
        borderLeft: '1px solid var(--line)',
        padding: open ? 16 : 4,
        overflowY: 'auto',
        transition: 'width 360ms cubic-bezier(0.65,0,0.35,1)',
      }}
      role="region"
      aria-label="Instrument rail: prediction lab controls"
    >
      {!open && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center', marginTop: 40 }}>
          {Array.from({ length: 19 }).map((_, i) => (
            <span key={i} style={{ width: 4, height: 4, borderRadius: 2, background: 'var(--gray-dim)' }} />
          ))}
        </div>
      )}
      {open && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <div className="t-num-hero">{focalP != null ? formatProbability(focalP) : '...'}</div>
            <InferenceLedger />
          </div>
          <FeatureControls metadata={metadata} />
          <button type="button" onClick={() => resetFeatures(customers)} className="t-label">
            Reset (R)
          </button>
        </div>
      )}
    </div>
  )
}
