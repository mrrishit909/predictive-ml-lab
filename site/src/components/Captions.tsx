/**
 * Narrative captions anchored to marks (composition.md z4, typography.md
 * rule 5): Bricolage claim + mono evidence, on a bg/70 backing so they stay
 * legible over the terrain. `side` places them opposite the focal point.
 *
 * responsive-spec.md: captions never sit over the terrain on mobile - the
 * terrain window there is only 58svh and every pixel is needed for the
 * field/points. Mobile's narrative instead lives in SentenceLab and each
 * beat's AccessibleFallback text, so this renders nothing there.
 */
import { useBreakpoint } from '../hooks/useBreakpoint'

export default function Captions({
  claim,
  evidence,
  body,
  side = 'left',
}: {
  claim: string
  evidence?: string
  body?: string
  side?: 'left' | 'right'
}) {
  const breakpoint = useBreakpoint()
  if (breakpoint === 'mobile') return null

  return (
    <div
      style={{
        position: 'absolute',
        top: '15%',
        [side]: 48,
        maxWidth: '44ch',
        background: 'rgba(11,17,16,0.7)',
        padding: 12,
        pointerEvents: 'none',
      }}
    >
      <p className="t-display" style={{ fontSize: 'clamp(32px, 5vw, 64px)', color: 'var(--ivory)' }}>{claim}</p>
      {evidence && (
        <p className="t-num" style={{ color: 'var(--ivory)', marginTop: 8 }}>
          {evidence}
        </p>
      )}
      {body && (
        <p className="t-body" style={{ color: 'var(--gray)', marginTop: 8, maxWidth: '44ch' }}>
          {body}
        </p>
      )}
    </div>
  )
}
