/**
 * The 10s intro timeline (design/approved/scroll-storyboard.md "Intro").
 * Pure and deterministic: given the same inputs, `frameAt(plan, t)` always
 * returns the same frame, which is what makes it testable and skippable
 * (skip just jumps the plan's clock to 10.0s).
 *
 * All "randomness" is seeded (src/data/seeds.ts): no Math.random() anywhere
 * in this file.
 */
import { forceSimulation, forceX, forceY, forceCollide } from 'd3-force'
import { randomLcg } from 'd3-random'
import { logit, clamp, lerp } from '../lib/math'
import { introSubsetIds, seededMotionFor, type SeededMotion } from '../data/seeds'
import { THRESHOLD } from './config'

export interface IntroRow {
  id: number
  p: number
  tenure: number
  monthlyCharges: number
  actualChurn: 0 | 1
}

export interface IntroPointPlan {
  id: number
  p: number
  tenure: number
  monthlyCharges: number
  actualChurn: 0 | 1
  motion: SeededMotion
  /** beeswarm x on the logit axis, normalized 0..1 across the rail, after 120 synchronous force ticks. */
  swarmX: number
  /** beeswarm y-axis spread from the collision force, roughly +/-0.16 around the rail's centerline. */
  swarmY: number
}

export interface IntroPlan {
  focalId: number
  points: IntroPointPlan[]
  /** t at which the coral 0.10 rule rises. */
  ruleT: number
}

export const INTRO_STEPS = {
  baseline: [0, 1.2] as const,
  drift: [1.2, 3.0] as const,
  beeswarm: [3.0, 5.2] as const,
  unfold: [5.2, 7.2] as const,
  camera: [7.2, 9.0] as const,
  hero: [9.0, 10.0] as const,
}

export const INTRO_DURATION_S = 10.0

/** Precomputes the deterministic subset, seeded drift params, and beeswarm layout. Call once. */
export function prepareIntro(allRows: IntroRow[], focalId: number): IntroPlan {
  const byId = new Map(allRows.map((r) => [r.id, r]))
  const subsetIds = introSubsetIds(allRows.map((r) => r.id), focalId, 199)
  const motionById = seededMotionFor(subsetIds)

  // Beeswarm: nodes start at x = target (logit position), y = 0 - no random
  // initial placement - then a seeded force sim (its own dedicated
  // d3.randomLcg(846) instance, per the storyboard) resolves y-axis overlap.
  const nodes = subsetIds.map((id) => {
    const row = byId.get(id)!
    const x = normalizedLogit(row.p)
    return { id, x, y: 0, targetX: x }
  })
  const sim = forceSimulation(nodes)
    .randomSource(randomLcg(846))
    .force('x', forceX((d) => (d as typeof nodes[number]).targetX).strength(1))
    .force('y', forceY(0).strength(0.02))
    .force('collide', forceCollide(0.012))
    .stop()
  for (let i = 0; i < 120; i++) sim.tick()

  const swarmXById = new Map(nodes.map((n) => [n.id, n.x]))
  const swarmYById = new Map(nodes.map((n) => [n.id, n.y]))

  const points: IntroPointPlan[] = subsetIds.map((id) => {
    const row = byId.get(id)!
    return {
      id: row.id,
      p: row.p,
      tenure: row.tenure,
      monthlyCharges: row.monthlyCharges,
      actualChurn: row.actualChurn,
      motion: motionById.get(id)!,
      swarmX: swarmXById.get(id)!,
      swarmY: swarmYById.get(id)!,
    }
  })

  return { focalId, points, ruleT: 4.4 }
}

/** logit(p), normalized to [0,1] over the fixtures' practical logit range. Exported: IntroScene draws the 0.10 rule at this exact x, not an approximation. */
export function normalizedLogit(p: number): number {
  const lo = logit(0.001)
  const hi = logit(0.999)
  return clamp((logit(p) - lo) / (hi - lo), 0, 1)
}

export type IntroStepName = keyof typeof INTRO_STEPS

export function introStepAt(t: number): IntroStepName {
  for (const name of Object.keys(INTRO_STEPS) as IntroStepName[]) {
    const [start, end] = INTRO_STEPS[name]
    if (t >= start && t < end) return name
  }
  return 'hero'
}

export interface IntroPointFrame {
  id: number
  /** normalized plot coords, 0..1 (x: tenure axis or rail axis depending on step; y similarly). */
  x: number
  y: number
  color: 'ivory' | 'mint' | 'coral'
  alpha: number
  isFocal: boolean
  ringForActualChurn: boolean
}

export interface IntroFrame {
  step: IntroStepName
  /** 0..1 progress within the current step. */
  stepProgress: number
  points: IntroPointFrame[]
  showThresholdRule: boolean
  showAxes: boolean
  showTerrain: boolean
  camera: { scale: number; cx: number; cy: number }
  caption: string
  evidence: string
  churnSideCount: number
  retainSideCount: number
}

function stepProgressOf(t: number, step: IntroStepName): number {
  const [start, end] = INTRO_STEPS[step]
  return clamp((t - start) / (end - start), 0, 1)
}

/**
 * Computes the full render-ready frame at time t (seconds). `modelReady`
 * gates whether the terrain is allowed to appear (scroll-storyboard.md: "If
 * ONNX is not ready, the plane shows points only... nothing here is
 * faked").
 */
export function frameAt(plan: IntroPlan, t: number, modelReady: boolean): IntroFrame {
  const step = introStepAt(t)
  const sp = stepProgressOf(t, step)
  const churnSideCount = plan.points.filter((pt) => pt.p >= THRESHOLD).length
  const retainSideCount = plan.points.length - churnSideCount

  const points: IntroPointFrame[] = plan.points.map((pt) => {
    const isFocal = pt.id === plan.focalId
    const swarmColor: IntroPointFrame['color'] =
      step === 'drift' || step === 'baseline'
        ? 'ivory'
        : pt.p >= THRESHOLD
          ? 'coral'
          : 'mint'

    let x = pt.swarmX
    let y = 0.5

    if (step === 'baseline') {
      x = pt.swarmX
      y = 0.5
    } else if (step === 'drift') {
      const dx = 12 * Math.sin(t * pt.motion.driftFreqX + pt.motion.driftPhaseX)
      const dy = 12 * Math.sin(t * pt.motion.driftFreqY + pt.motion.driftPhaseY)
      x = clamp(pt.swarmX + dx / 400, 0, 1)
      y = clamp(0.5 + dy / 400, 0, 1)
    } else if (step === 'beeswarm') {
      x = pt.swarmX
      y = 0.5 + pt.swarmY
    } else if (step === 'unfold' || step === 'camera' || step === 'hero') {
      // unfold: rail -> 2D plane (tenure x, charge y)
      const planeX = pt.tenure / 72
      const planeY = 1 - clamp((pt.monthlyCharges - 18.25) / (118.75 - 18.25), 0, 1)
      const unfoldT = step === 'unfold' ? ease(sp) : 1
      x = lerp(pt.swarmX, planeX, unfoldT)
      y = lerp(0.5 + pt.swarmY, planeY, unfoldT)
    }

    return {
      id: pt.id,
      x,
      y,
      color: swarmColor,
      alpha: step === 'camera' || step === 'hero' ? (isFocal ? 1 : 0.35) : 1,
      isFocal,
      ringForActualChurn: pt.actualChurn === 1,
    }
  })

  const camera = cameraFor(step, sp)

  return {
    step,
    stepProgress: sp,
    points,
    // Simplification (documented): the storyboard has this rule "hand off"
    // into the terrain's own 0.10 contour during unfold. This intro doesn't
    // render the terrain (showTerrain is model-ready-gated and, even when
    // ready, the Hero workspace's TerrainStack takes over after finish()),
    // so there is nothing real for the rule to hand off to - keeping it
    // drawn past the beeswarm step would make it a decorative line with no
    // meaning on the tenure/charge plane, which is the project's hard
    // rejection condition. It is shown only where it's real: on the rail.
    showThresholdRule: step === 'beeswarm' && t >= plan.ruleT,
    showAxes: step === 'unfold' || step === 'camera' || step === 'hero',
    showTerrain: (step === 'unfold' || step === 'camera' || step === 'hero') && modelReady,
    camera,
    caption: captionFor(step, modelReady),
    evidence: evidenceFor(step, churnSideCount, retainSideCount),
    churnSideCount,
    retainSideCount,
  }
}

function ease(t: number): number {
  // cubic in-out, matches ease.inOut without importing d3-ease here (one line, not worth the dependency edge).
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

function cameraFor(step: IntroStepName, sp: number): { scale: number; cx: number; cy: number } {
  if (step === 'camera') return { scale: lerp(1, 2.6, ease(sp)), cx: 0.33, cy: 0.5 }
  if (step === 'hero') return { scale: lerp(2.6, 1.4, ease(sp)), cx: 0.33, cy: 0.5 }
  return { scale: 1, cx: 0.5, cy: 0.5 }
}

function captionFor(step: IntroStepName, modelReady: boolean): string {
  switch (step) {
    case 'baseline':
      return '400 customers the model never saw · 200 shown'
    case 'drift':
      return '400 customers the model never saw · 200 shown'
    case 'beeswarm':
      return 'threshold 0.10 · cost-optimal (FN $500 · FP $50)'
    case 'unfold':
      return modelReady ? 'The model answers for every point on this plane.' : 'model warming…'
    case 'camera':
      return 'Standing on the model’s output surface.'
    case 'hero':
      return 'Drag her. The model answers every frame.'
  }
}

function evidenceFor(step: IntroStepName, churnSide: number, retainSide: number): string {
  if (step === 'beeswarm' || step === 'unfold' || step === 'camera' || step === 'hero') {
    return `churn side ${churnSide} · retain side ${retainSide}`
  }
  return ''
}
