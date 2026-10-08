/**
 * All deterministic "randomness" in the site draws from named, seeded d3
 * generators - never Math.random(). See composition.md (point jitter) and
 * scroll-storyboard.md (intro drift/beeswarm).
 *
 * One `d3.randomLcg(846)` stream is created once and drawn from in ascending
 * customer-id order, once per customer, for the jitter + drift parameters
 * below. Per composition.md's explicit warning, consecutive seeds
 * (`d3.randomLcg(id)`) give nearly-identical first draws, so a single shared
 * stream advanced per customer is used instead, not a fresh RNG per id.
 */
import { randomLcg } from 'd3-random'
import { shuffler } from 'd3-array'

export interface SeededMotion {
  /** tenure-axis jitter in [-0.35, 0.35], composition.md's deterministic de-overlap for duplicate integer tenures. */
  jitterX: number
  /** intro drift (scroll-storyboard.md step 1.2-3.0s): dx = 12*sin(t*freqX + phaseX) */
  driftFreqX: number
  driftPhaseX: number
  driftFreqY: number
  driftPhaseY: number
}

let cache: Map<number, SeededMotion> | null = null

/** Computes (once) and returns the seeded per-customer motion params, keyed by id, for ids 0..399. */
export function seededMotionFor(ids: number[]): Map<number, SeededMotion> {
  if (cache) return cache
  const rng = randomLcg(846)
  const sorted = [...ids].sort((a, b) => a - b)
  const map = new Map<number, SeededMotion>()
  for (const id of sorted) {
    const jitterX = (rng() - 0.5) * 0.7 // -> [-0.35, 0.35]
    const driftFreqX = 0.4 + rng() * 0.5 // 0.4-0.9 rad/s
    const driftPhaseX = rng() * Math.PI * 2
    const driftFreqY = 0.4 + rng() * 0.5
    const driftPhaseY = rng() * Math.PI * 2
    map.set(id, { jitterX, driftFreqX, driftPhaseX, driftFreqY, driftPhaseY })
  }
  cache = map
  return map
}

/**
 * The ~200-point intro subset: a deterministic shuffle of all 400 ids,
 * taking the first 199 and always adding the focal customer.
 * `d3.shuffler` (not `d3.shuffle`, which uses Math.random) is deterministic
 * when given a seeded source.
 */
export function introSubsetIds(allIds: number[], focalId: number, count = 199): number[] {
  const shuffle = shuffler(randomLcg(846))
  const shuffled = shuffle(allIds.filter((id) => id !== focalId))
  const subset = shuffled.slice(0, count)
  return [...subset, focalId]
}
