import { useEffect, useRef } from 'react'
import AccessibleFallback from '../components/AccessibleFallback'
import ContributionLedger from '../components/ContributionLedger'
import { useAppState } from '../state/store'
import { useBreakpoint } from '../hooks/useBreakpoint'
import type { CustomerRow, TopFactor, ModelMetadata } from '../data/fixtures'

export default function BeatExplanation({
  focal,
  topFactors,
  requestSensitivity,
  metadata,
}: {
  focal: CustomerRow | undefined
  topFactors: TopFactor[] | null
  requestSensitivity: (customer: CustomerRow) => void
  metadata: ModelMetadata
}) {
  const beatIndex = useAppState((s) => s.beatIndex)
  const edited = useAppState((s) => s.edited)
  const features = useAppState((s) => s.features)
  const sensitivity = useAppState((s) => s.sensitivity)
  const breakpoint = useBreakpoint()
  const lastRequestedFor = useRef<string | null>(null)

  useEffect(() => {
    if (beatIndex !== 5 || !features) return
    const key = JSON.stringify(features)
    if (lastRequestedFor.current === key) return
    lastRequestedFor.current = key
    // The worker computes its own baseline from this exact row in the same
    // batch call (gridWorker.ts), so there's no race with the store's
    // separately-arriving `focalP` for this same edit.
    requestSensitivity({ ...(focal as CustomerRow), ...features })
  }, [beatIndex, features, focal, requestSensitivity])

  if (beatIndex !== 5 || !focal) {
    return (
      <AccessibleFallback heading="Beat 5: Explanation">
        SHAP values explain the original customer&rsquo;s prediction in the base model&rsquo;s log-odds space; live
        sensitivity shows the exact change in calibrated probability for any single edited feature.
      </AccessibleFallback>
    )
  }

  return (
    <>
      {breakpoint !== 'mobile' && (
        <div style={{ position: 'absolute', right: 48, top: '15%' }}>
          <ContributionLedger focal={focal} topFactors={topFactors} sensitivity={sensitivity} edited={edited} metadata={metadata} />
        </div>
      )}
      <AccessibleFallback heading="Beat 5: Explanation">
        {edited
          ? 'Showing live sensitivity for the edited customer: the exact change in calibrated probability for each possible single-feature switch.'
          : `Showing SHAP contributions for the original customer's prediction, plus live sensitivity side by side.`}
      </AccessibleFallback>
    </>
  )
}
