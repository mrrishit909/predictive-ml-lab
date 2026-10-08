/** Small shared numeric helpers used by the terrain ramp, contours and the intro's threshold rail. */

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v))
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/** logit(p) = ln(p / (1-p)), clamped to avoid +/-Infinity at the fixture's exact 0/1 rows. */
export function logit(p: number, eps = 0.001): number {
  const c = clamp(p, eps, 1 - eps)
  return Math.log(c / (1 - c))
}
