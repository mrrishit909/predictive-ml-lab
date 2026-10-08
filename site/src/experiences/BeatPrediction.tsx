import { useEffect, useState } from 'react'
import Captions from '../components/Captions'
import AccessibleFallback from '../components/AccessibleFallback'
import CallItButtons from '../components/CallItButtons'
import { useAppState, setCallItAnswered } from '../state/store'
import { useBreakpoint } from '../hooks/useBreakpoint'
import type { CustomerRow } from '../data/fixtures'

export default function BeatPrediction({ focal }: { focal: CustomerRow | undefined }) {
  const beatIndex = useAppState((s) => s.beatIndex)
  const answered = useAppState((s) => s.callItAnswered)
  const [hintShown, setHintShown] = useState(true)
  const breakpoint = useBreakpoint()

  useEffect(() => {
    if (beatIndex !== 4) return
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement) return
      if (e.key === '1') setCallItAnswered('Stayed')
      if (e.key === '2') setCallItAnswered('Left')
    }
    window.addEventListener('keydown', onKey)
    const id = setTimeout(() => setHintShown(false), 6000)
    return () => {
      window.removeEventListener('keydown', onKey)
      clearTimeout(id)
    }
  }, [beatIndex])

  if (beatIndex !== 4) {
    return (
      <AccessibleFallback heading="Beat 4: Prediction laboratory">
        Every change re-runs the shipped model: five gradient-boosted folds, isotonic-calibrated, averaged.
      </AccessibleFallback>
    )
  }

  return (
    <>
      {breakpoint !== 'mobile' && (
        <div style={{ position: 'absolute', left: 48, top: '20%' }}>
          {!answered && <CallItButtons focal={focal} />}
          {answered && (
            <>
              <CallItButtons focal={focal} />
              <Captions
                claim="Your turn."
                body="Every change re-runs the shipped model: five gradient-boosted folds, isotonic-calibrated, averaged. Nothing here is a lookup table."
                evidence="matches scikit-learn within 1e-4 on 398/400 held-out rows · max deviation 0.012"
              />
            </>
          )}
          {hintShown && answered && (
            <p className="t-body" style={{ color: 'var(--mint)', marginTop: 12 }}>
              &rarr; Drag her right.
            </p>
          )}
        </div>
      )}
      <AccessibleFallback heading="Beat 4: Prediction laboratory">
        The prediction lab lets you edit any of 19 features; the model re-runs live. It matches scikit-learn within
        1e-4 on 398 of 400 held-out rows, with a maximum deviation of 0.012 that never flips a classification.
      </AccessibleFallback>
    </>
  )
}
