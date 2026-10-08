import Captions from '../components/Captions'
import AccessibleFallback from '../components/AccessibleFallback'
import { useAppState } from '../state/store'
import { formatProbability } from '../lib/format'
import type { CustomerRow } from '../data/fixtures'

export default function HeroWorkspace({ focal }: { focal: CustomerRow | undefined }) {
  const beatIndex = useAppState((s) => s.beatIndex)
  const focalP = useAppState((s) => s.focalP)
  return (
    <>
      {beatIndex === 0 && (
        <Captions claim="Drag her. The model answers every frame." side="right" />
      )}
      <AccessibleFallback heading="Hero workspace">
        {focal
          ? `Customer #${focal.id}: ${focal.tenure} months tenure, $${focal.MonthlyCharges.toFixed(2)} monthly, ${focal.Contract} contract, ${focal.InternetService} internet. Model churn probability ${focalP != null ? formatProbability(focalP) : 'loading'}. Actually ${focal.actual_churn ? 'churned' : 'stayed'}. Drag the crosshair or use arrow keys to change tenure and monthly charge; the model recomputes live.`
          : 'Loading the focal customer.'}
      </AccessibleFallback>
    </>
  )
}
