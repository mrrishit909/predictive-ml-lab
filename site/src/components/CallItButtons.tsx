/**
 * The "Call it" predict-first moment (beat 4, scroll-storyboard.md), shown
 * once per session: ask the visitor to guess before revealing the actual
 * outcome and the model's prediction.
 */
import { useAppState, setCallItAnswered } from '../state/store'
import { formatProbability } from '../lib/format'
import { THRESHOLD } from '../motion/config'
import type { CustomerRow } from '../data/fixtures'

export default function CallItButtons({ focal }: { focal: CustomerRow | undefined }) {
  const answered = useAppState((s) => s.callItAnswered)
  const focalP = useAppState((s) => s.focalP)

  if (!focal) return null

  if (!answered) {
    return (
      <div style={{ background: 'rgba(11,17,16,0.7)', padding: 16, maxWidth: '44ch' }}>
        <p className="t-lede" style={{ color: 'var(--ivory)' }}>
          Did #{focal.id} leave?
        </p>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button type="button" className="t-label" onClick={() => setCallItAnswered('Stayed')}>
            Stayed (1)
          </button>
          <button type="button" className="t-label" onClick={() => setCallItAnswered('Left')}>
            Left (2)
          </button>
          <button type="button" className="t-label" onClick={() => setCallItAnswered('skip')} style={{ color: 'var(--gray)' }}>
            Skip
          </button>
        </div>
      </div>
    )
  }

  const actualLeft = focal.actual_churn === 1
  const predictedLeft = (focalP ?? 0) >= THRESHOLD
  const guessedLeft = answered === 'Left'
  const agreed = answered === 'skip' || guessedLeft === predictedLeft

  return (
    <div style={{ background: 'rgba(11,17,16,0.7)', padding: 16, maxWidth: '44ch' }}>
      <p className="t-num" style={{ color: actualLeft ? 'var(--coral)' : 'var(--mint)' }}>
        actual: {actualLeft ? 'churned' : 'stayed'}
      </p>
      <p className="t-num" style={{ color: predictedLeft ? 'var(--coral)' : 'var(--mint)' }}>
        model: p {focalP != null ? formatProbability(focalP) : '...'} {predictedLeft ? '→ flagged' : '→ not flagged'}
      </p>
      {answered !== 'skip' && (
        <p className="t-micro">you {agreed ? 'agreed' : 'disagreed'} with the model</p>
      )}
    </div>
  )
}
