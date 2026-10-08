/**
 * Easing curves, motion-bible.md "Easing curves (time-based tweens)".
 * d3-ease functions for canvas/JS tweens; CSS strings for the DOM
 * transitions owned by CSS (captions, rail, tooltips - see transitions.ts).
 */
import { easeExpOut, easeExpIn, easeCubicInOut, easeLinear, easeQuadOut } from 'd3-ease'

export const ease = {
  out: easeExpOut, // elements arriving
  in: easeExpIn, // elements leaving (caller uses 0.66x the enter duration)
  inOut: easeCubicInOut, // intro camera moves, axis<->terrain unfold
  linear: easeLinear, // scroll progress, contour draw-on, row reveal
  number: easeQuadOut, // number ticker interpolation
} as const

export const easeCSS = {
  out: 'cubic-bezier(0.16, 1, 0.3, 1)',
  in: 'cubic-bezier(0.7, 0, 0.84, 0)',
  inOut: 'cubic-bezier(0.65, 0, 0.35, 1)',
  linear: 'linear',
  number: 'cubic-bezier(0.2, 0, 0, 1)',
} as const

/** "leaving" tweens run at 0.66x the matching "arriving" duration (motion-bible.md). */
export function leaveDuration(enterMs: number): number {
  return Math.round(enterMs * 0.66)
}
