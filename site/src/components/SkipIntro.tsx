/**
 * First in tab order, visible from frame 0 (scroll-storyboard.md). Esc also skips.
 */
export default function SkipIntro({ onSkip }: { onSkip: () => void }) {
  return (
    <button
      type="button"
      onClick={onSkip}
      className="t-label"
      style={{
        position: 'absolute',
        top: 16,
        right: 16,
        zIndex: 10,
        background: 'var(--surface-1)',
        color: 'var(--ivory)',
        border: '1px solid var(--line)',
        padding: '8px 12px',
      }}
    >
      Skip intro (Esc)
    </button>
  )
}
