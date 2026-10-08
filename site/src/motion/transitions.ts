/**
 * DOM-owned motion: CSS `opacity`/`transform` transitions (captions, rail,
 * tooltips - motion-bible.md "Property ownership" table) and the number
 * ticker that owns LIVE/FIXTURE numeral text content.
 */
import { useEffect, useRef, useState } from 'react'
import { timer as d3timer, type Timer } from 'd3-timer'
import { easeQuadOut } from 'd3-ease'
import { DURATION } from './config'
import { effectiveDuration } from './reduced-motion'

/** Inline style for a DOM element whose opacity/transform is CSS-owned. */
export function cssTransitionStyle(ms: number, easeCss: string): React.CSSProperties {
  return { transition: `opacity ${ms}ms ${easeCss}, transform ${ms}ms ${easeCss}` }
}

/**
 * Tweens a displayed number toward `target` over `duration`, retargeting
 * from the current displayed value (never queuing) if target changes
 * mid-tween. Returns the live display value; callers detect threshold
 * crossings themselves with `didCross` (below) since what happens on a
 * cross - tag color, rail pulse - differs per element.
 */
export function useNumberTicker(target: number | null, reduced: boolean, duration = DURATION.short): number {
  const [display, setDisplay] = useState(target ?? 0)
  const displayRef = useRef(display)
  displayRef.current = display
  const timerRef = useRef<Timer | null>(null)

  useEffect(() => {
    if (target == null) return
    const ms = effectiveDuration(duration, reduced)
    if (ms === 0) {
      setDisplay(target)
      return
    }
    const from = displayRef.current
    const to = target
    timerRef.current?.stop()
    timerRef.current = d3timer((elapsed) => {
      const t = Math.min(1, elapsed / ms)
      setDisplay(from + (to - from) * easeQuadOut(t))
      if (t >= 1) timerRef.current?.stop()
    })
    return () => timerRef.current?.stop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, reduced, duration])

  return display
}

/** True if a value crossed the threshold between two samples (either direction). */
export function didCross(prev: number, next: number, threshold: number): boolean {
  return (prev < threshold && next >= threshold) || (prev >= threshold && next < threshold)
}
