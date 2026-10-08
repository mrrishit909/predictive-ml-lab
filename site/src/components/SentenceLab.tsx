/**
 * Mobile Prediction Lab: the explorable sentence borrowed from Concept B
 * (responsive-spec.md / selection.md), not a reflowed desktop rail. Tapping
 * an italic word cycles it to its next valid value (a lightweight stand-in
 * for the spec's bottom-sheet picker - same real feature update, simpler
 * chrome, given this is a single mobile surface rather than a native sheet
 * component); "All 19 features" opens the full FeatureControls list.
 */
import { useState } from 'react'
import FeatureControls from './FeatureControls'
import { useAppState, updateFeature } from '../state/store'
import type { ModelMetadata } from '../data/fixtures'
import { displayValue } from '../data/labels'

function Word({ children, onTap }: { children: React.ReactNode; onTap: () => void }) {
  return (
    <button
      type="button"
      onClick={onTap}
      className="t-lede"
      style={{
        background: 'none',
        border: 'none',
        borderBottom: '1px dashed var(--mint)',
        color: 'var(--mint)',
        fontStyle: 'italic',
        padding: 0,
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  )
}

function cycle(options: string[], current: string): string {
  const i = options.indexOf(current)
  return options[(i + 1) % options.length]
}

export default function SentenceLab({ metadata }: { metadata: ModelMetadata }) {
  const features = useAppState((s) => s.features)
  const [showAll, setShowAll] = useState(false)
  if (!features) return null

  const genderOpts = metadata.category_values.gender
  const contractOpts = metadata.category_values.Contract
  const internetOpts = metadata.category_values.InternetService.filter((v) => v !== 'No internet service')

  return (
    <div style={{ padding: 16 }}>
      <p className="t-lede" style={{ color: 'var(--ivory)', maxWidth: '40ch' }}>
        A <Word onTap={() => updateFeature('gender', cycle(genderOpts, features.gender))}>{displayValue('gender', features.gender).toLowerCase()}</Word>{' '}
        customer, <Word onTap={() => updateFeature('tenure', (features.tenure % 72) + 1)}>{features.tenure}</Word> months in, paying $
        <Word onTap={() => updateFeature('MonthlyCharges', Math.min(118.75, features.MonthlyCharges + 5))}>
          {features.MonthlyCharges.toFixed(2)}
        </Word>
        /mo on a{' '}
        <Word onTap={() => updateFeature('Contract', cycle(contractOpts, features.Contract))}>
          {features.Contract.toLowerCase()}
        </Word>{' '}
        contract with{' '}
        <Word onTap={() => updateFeature('InternetService', cycle(internetOpts, features.InternetService))}>
          {features.InternetService}
        </Word>
        .
      </p>
      <button type="button" onClick={() => setShowAll(true)} className="t-label" style={{ marginTop: 12 }}>
        All 19 features
      </button>
      {showAll && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="All 19 features"
          style={{ position: 'fixed', inset: 0, background: 'var(--bg)', zIndex: 20, padding: 16, overflowY: 'auto' }}
        >
          <button type="button" onClick={() => setShowAll(false)} className="t-label">
            Close
          </button>
          <div style={{ marginTop: 16 }}>
            <FeatureControls metadata={metadata} />
          </div>
        </div>
      )}
    </div>
  )
}
