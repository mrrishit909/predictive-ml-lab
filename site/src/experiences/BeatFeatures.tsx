import { useEffect, useMemo } from 'react'
import Captions from '../components/Captions'
import AccessibleFallback from '../components/AccessibleFallback'
import { useAppState, setLens } from '../state/store'
import { subStep } from '../motion/scroll-scenes'
import { humanFeatureName, parseShapFeature } from '../data/labels'
import { useBreakpoint } from '../hooks/useBreakpoint'
import type { CustomerRow, GlobalImportance } from '../data/fixtures'
import type { FeatureLens } from '../state/store'

/** Exported so the mobile lower panel's chip row (responsive-spec.md) can reuse the same lens cycle. */
export const LENS_ORDER: FeatureLens[] = ['Contract', 'tenure', 'InternetService']

export default function BeatFeatures({ customers, globalImportance }: { customers: CustomerRow[]; globalImportance: GlobalImportance[] }) {
  const beatIndex = useAppState((s) => s.beatIndex)
  const beatProgress = useAppState((s) => s.beatProgress)
  const lens = useAppState((s) => s.lens)
  const breakpoint = useBreakpoint()

  useEffect(() => {
    if (beatIndex !== 2) return
    setLens(LENS_ORDER[subStep(beatProgress)])
  }, [beatIndex, beatProgress])

  const contractCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const c of customers) counts[c.Contract] = (counts[c.Contract] ?? 0) + 1
    return counts
  }, [customers])

  if (beatIndex !== 2) {
    return (
      <AccessibleFallback heading="Beat 2: Features">
        Nineteen raw features describe each customer; a feature lens recolors the population by Contract, tenure, or
        internet service.
      </AccessibleFallback>
    )
  }

  return (
    <>
      <Captions
        claim="Nineteen things we know about them."
        evidence={`Month-to-month ${contractCounts['Month-to-month'] ?? 0} · One year ${contractCounts['One year'] ?? 0} · Two year ${contractCounts['Two year'] ?? 0}`}
      />
      {breakpoint !== 'mobile' && (
        <div
          style={{
            position: 'absolute',
            right: 48,
            top: '20%',
            maxWidth: 320,
            background: 'rgba(11,17,16,0.7)',
            padding: 12,
            maxHeight: '60%',
            overflowY: 'auto',
          }}
        >
          <p className="t-label">mean |SHAP| · log-odds · base model</p>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {globalImportance.map((g) => {
              const parsed = parseShapFeature(g.feature)
              const active = parsed.rawFeature === lens
              return (
                <li key={g.feature}>
                  <button
                    type="button"
                    onClick={() => setLens(LENS_ORDER.includes(parsed.rawFeature as FeatureLens) ? (parsed.rawFeature as FeatureLens) : lens)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      justifyContent: 'space-between',
                      background: active ? 'var(--surface-2)' : 'none',
                      border: 'none',
                      color: active ? 'var(--ivory)' : 'var(--gray)',
                      padding: '4px 6px',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <span className="t-num">
                      {humanFeatureName(parsed.rawFeature)} <span className="t-micro">{g.feature}</span>
                    </span>
                    <span className="t-num">{g.mean_abs_impact.toFixed(3)}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
      <AccessibleFallback heading="Beat 2: Features">
        {`Feature lens active: ${lens}. Contract distribution: Month-to-month ${contractCounts['Month-to-month'] ?? 0}, One year ${contractCounts['One year'] ?? 0}, Two year ${contractCounts['Two year'] ?? 0}.`}
      </AccessibleFallback>
    </>
  )
}
