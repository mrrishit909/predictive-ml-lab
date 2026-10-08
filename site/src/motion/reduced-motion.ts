/**
 * `prefers-reduced-motion: reduce` support, per motion-bible.md "Reduced
 * motion". Read once at start and observed live (a user can toggle OS
 * settings without reloading).
 *
 * Reduced motion never means reduced content or reduced model: inference
 * still runs live: only *positional* tweens/springs/camera moves become
 * instant. Opacity crossfades are kept, capped at 120ms.
 */
import { useEffect, useState } from 'react'
import { DURATION } from './config'

const QUERY = '(prefers-reduced-motion: reduce)'

export function prefersReducedMotionNow(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia(QUERY).matches
}

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(prefersReducedMotionNow)
  useEffect(() => {
    if (!window.matchMedia) return
    const mq = window.matchMedia(QUERY)
    const onChange = () => setReduced(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return reduced
}

/** Crossfades are kept under reduced motion, capped at 120ms; everything else collapses to 0. */
export function effectiveDuration(token: number, reduced: boolean, kind: 'position' | 'opacity' = 'position'): number {
  if (!reduced) return token
  if (kind === 'opacity') return Math.min(token, DURATION.micro)
  return DURATION.instant
}

/** The three static intro frames shown under reduced motion (scroll-storyboard.md). */
export type ReducedIntroFrame = 'rail' | 'plane' | 'hero'
export const REDUCED_INTRO_FRAMES: ReducedIntroFrame[] = ['rail', 'plane', 'hero']
export const REDUCED_INTRO_FRAME_HOLD_MS = 1200
export const REDUCED_INTRO_CROSSFADE_MS = 120
