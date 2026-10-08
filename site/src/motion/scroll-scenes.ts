/**
 * Scroll -> (beatIndex, beatProgress) mapping, per motion-bible.md "Scroll
 * mapping" and scroll-storyboard.md's beat-length table. `ScrollController`
 * owns only these two numbers in the store; it never touches a visual
 * property directly - visual targets are pure functions of them, computed
 * by each beat component.
 *
 * Beat 0 is the Hero workspace. Beats 1-5 (Data, Features, Decision
 * Boundary, Prediction, Explanation) are the sticky scroll track handled
 * here. Beat 6 (Evaluation) un-sticks and uses its own IntersectionObserver
 * (see experiences/BeatEvaluation.tsx), not this hook.
 */
import { useEffect, useRef, type RefObject } from 'react'
import { setBeat } from '../state/store'

export const BEAT_NAMES = ['hero', 'data', 'features', 'boundary', 'prediction', 'explanation'] as const

/** vh length of each beat's scroll track (desktop reference; same proportions at every breakpoint). */
export const BEAT_LENGTHS_VH = [100, 150, 200, 250, 150, 200] as const

export const TOTAL_SCROLL_TRACK_VH = BEAT_LENGTHS_VH.reduce((a, b) => a + b, 0)

/** Sub-step thresholds within a beat (motion-bible.md: 0.0, 0.33, 0.66). */
export function subStep(progress: number): 0 | 1 | 2 {
  if (progress < 0.33) return 0
  if (progress < 0.66) return 1
  return 2
}

/**
 * Attaches a passive scroll/resize listener and writes {beatIndex,
 * beatProgress} into the store. Recomputes beat boundaries on resize and
 * font load, since they're in vh. Cleans up both listeners on unmount.
 */
export function useScrollBeats(containerRef: RefObject<HTMLElement | null>) {
  const boundsPxRef = useRef<number[]>([])

  useEffect(() => {
    function recomputeBounds() {
      const vh = window.innerHeight
      let acc = 0
      const bounds = [0]
      for (const lenVh of BEAT_LENGTHS_VH) {
        acc += (lenVh / 100) * vh
        bounds.push(acc)
      }
      boundsPxRef.current = bounds
    }

    function onScroll() {
      const container = containerRef.current
      if (!container) return
      const rect = container.getBoundingClientRect()
      const scrolled = Math.max(0, -rect.top)
      const bounds = boundsPxRef.current
      const total = bounds[bounds.length - 1]
      const clamped = Math.min(scrolled, total)

      let beatIndex = 0
      for (let i = 0; i < BEAT_LENGTHS_VH.length; i++) {
        if (clamped >= bounds[i] && clamped <= bounds[i + 1]) {
          beatIndex = i
          break
        }
        if (clamped > bounds[i + 1]) beatIndex = i + 1
      }
      beatIndex = Math.min(beatIndex, BEAT_LENGTHS_VH.length - 1)
      const start = bounds[beatIndex]
      const length = bounds[beatIndex + 1] - start || 1
      const beatProgress = Math.min(1, Math.max(0, (clamped - start) / length))
      setBeat(beatIndex, beatProgress)
    }

    recomputeBounds()
    onScroll()
    window.addEventListener('resize', recomputeBounds, { passive: true })
    window.addEventListener('scroll', onScroll, { passive: true })
    document.fonts?.ready?.then(recomputeBounds).catch(() => {})
    return () => {
      window.removeEventListener('resize', recomputeBounds)
      window.removeEventListener('scroll', onScroll)
    }
  }, [containerRef])
}
