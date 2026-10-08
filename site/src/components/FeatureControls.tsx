/**
 * The 19 raw feature controls, grouped per interaction-map.md's Instrument
 * rail: Account, Services, Demographics. Generic over metadata.json's
 * category_values (never hardcoded), used by the desktop rail, the tablet
 * dock's full sheet, and the mobile "all 19 features" sheet.
 */
import type { CustomerFeatures } from '../inference/churnModel'
import type { ModelMetadata } from '../data/fixtures'
import { humanFeatureName, displayValue } from '../data/labels'
import { isControlDisabled, TENURE_RANGE, MONTHLY_CHARGES_RANGE } from '../data/constraints'
import { updateFeature, setTotalChargesLinked, useAppState } from '../state/store'

const GROUPS: { title: string; keys: (keyof CustomerFeatures)[] }[] = [
  {
    title: 'Account',
    keys: ['tenure', 'MonthlyCharges', 'TotalCharges', 'Contract', 'PaperlessBilling', 'PaymentMethod'],
  },
  {
    title: 'Services',
    keys: [
      'PhoneService',
      'MultipleLines',
      'InternetService',
      'OnlineSecurity',
      'OnlineBackup',
      'DeviceProtection',
      'TechSupport',
      'StreamingTV',
      'StreamingMovies',
    ],
  },
  { title: 'Demographics', keys: ['gender', 'SeniorCitizen', 'Partner', 'Dependents'] },
]

function SegmentedControl({
  featureKey,
  value,
  options,
  disabled,
}: {
  featureKey: keyof CustomerFeatures
  value: string
  options: string[]
  disabled: boolean
}) {
  return (
    <div role="radiogroup" aria-label={humanFeatureName(featureKey as string)} style={{ display: 'flex', gap: 4 }}>
      {options.map((opt) => {
        const active = opt === value
        return (
          <button
            key={opt}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => updateFeature(featureKey, opt)}
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              padding: '6px 10px',
              background: active ? 'var(--surface-2)' : 'var(--surface-1)',
              color: disabled ? 'var(--gray-dim)' : active ? 'var(--ivory)' : 'var(--gray)',
              border: active ? '1px solid var(--mint)' : '1px solid var(--line)',
              borderRadius: 2,
              cursor: disabled ? 'not-allowed' : 'pointer',
            }}
            title={disabled ? 'requires internet' : undefined}
          >
            {displayValue(featureKey as string, opt)}
          </button>
        )
      })}
    </div>
  )
}

function NumericScrubber({
  label,
  value,
  min,
  max,
  step,
  onChange,
  suffix,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
  suffix?: string
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span className="t-label">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-valuetext={`${value}${suffix ?? ''}`}
      />
      <span className="t-num" style={{ color: 'var(--ivory)' }}>
        {value}
        {suffix}
      </span>
    </label>
  )
}

export default function FeatureControls({ metadata }: { metadata: ModelMetadata }) {
  const features = useAppState((s) => s.features)
  const totalChargesLinked = useAppState((s) => s.totalChargesLinked)
  if (!features) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {GROUPS.map((group) => (
        <fieldset key={group.title} style={{ border: 'none', margin: 0, padding: 0 }}>
          <legend className="t-label" style={{ color: 'var(--gray)', marginBottom: 8 }}>
            {group.title}
          </legend>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {group.keys.map((key) => {
              if (key === 'tenure') {
                return (
                  <NumericScrubber
                    key={key}
                    label="Tenure"
                    value={features.tenure}
                    min={TENURE_RANGE.min}
                    max={TENURE_RANGE.max}
                    step={1}
                    suffix=" mo"
                    onChange={(v) => updateFeature('tenure', v)}
                  />
                )
              }
              if (key === 'MonthlyCharges') {
                return (
                  <NumericScrubber
                    key={key}
                    label="Monthly charge"
                    value={features.MonthlyCharges}
                    min={MONTHLY_CHARGES_RANGE.min}
                    max={MONTHLY_CHARGES_RANGE.max}
                    step={0.05}
                    suffix=" $"
                    onChange={(v) => updateFeature('MonthlyCharges', v)}
                  />
                )
              }
              if (key === 'TotalCharges') {
                return (
                  <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span className="t-label">Total charges</span>
                    <input
                      type="number"
                      value={features.TotalCharges}
                      disabled={totalChargesLinked}
                      onChange={(e) => updateFeature('TotalCharges', Number(e.target.value))}
                      className="t-num"
                      style={{ background: 'var(--surface-1)', color: 'var(--ivory)', border: '1px solid var(--line)', padding: 4 }}
                    />
                    <label style={{ display: 'flex', gap: 6, alignItems: 'center' }} className="t-micro">
                      <input
                        type="checkbox"
                        checked={totalChargesLinked}
                        onChange={(e) => setTotalChargesLinked(e.target.checked)}
                      />
                      linked: tenure &times; monthly
                    </label>
                    {!totalChargesLinked && (
                      <span className="t-micro">unlinked: real customers&rsquo; totals &asymp; tenure &times; monthly</span>
                    )}
                  </div>
                )
              }
              // "No internet/phone service" are derived states, not directly selectable (interaction-map.md rule 3).
              const options = metadata.category_values[key as string]?.filter(
                (v) => v !== 'No internet service' && v !== 'No phone service'
              )
              if (!options || options.length === 0) return null
              const disabled = isControlDisabled(features, key)
              return (
                <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span className="t-label">{humanFeatureName(key as string)}</span>
                  <SegmentedControl
                    featureKey={key}
                    value={String(features[key])}
                    options={options}
                    disabled={disabled}
                  />
                </div>
              )
            })}
          </div>
        </fieldset>
      ))}
    </div>
  )
}
