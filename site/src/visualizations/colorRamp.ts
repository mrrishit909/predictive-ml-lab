/**
 * The terrain color ramp, design/approved/colors.md "Terrain ramp":
 * diverging, centered on the 0.10 threshold (not 0.5), in logit space so
 * the narrow 0-0.10 band gets visual room.
 */
import { logit } from '../lib/math'
import { THRESHOLD } from '../motion/config'

const T10 = logit(THRESHOLD)
const T001 = logit(0.001)
const T999 = logit(0.999)

const BG = [11, 17, 16] as const
const MINT = [181, 255, 206] as const
const CORAL = [255, 134, 109] as const

function mix(a: readonly [number, number, number], b: readonly [number, number, number], alpha: number): [number, number, number] {
  return [a[0] + (b[0] - a[0]) * alpha, a[1] + (b[1] - a[1]) * alpha, a[2] + (b[2] - a[2]) * alpha]
}

/** Returns [r,g,b] 0-255 for a calibrated probability p. */
export function terrainColor(p: number): [number, number, number] {
  const t = logit(p, 0.001)
  if (t < T10) {
    const s = (T10 - t) / (T10 - T001)
    return mix(BG, MINT, 0.22 * s)
  }
  const s = (t - T10) / (T999 - T10)
  return mix(BG, CORAL, 0.38 * s)
}

export const ISO_LEVELS = [0.05, THRESHOLD, 0.25, 0.5] as const
