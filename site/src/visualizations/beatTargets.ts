/**
 * Pure beat -> visual-target mapping (motion-bible.md: "Visual targets are
 * pure functions of (beatIndex, beatProgress)"). Consumed by TerrainStack,
 * which owns the actual canvas drawing. No side effects, no store access -
 * everything needed is passed in, which is what makes this unit-testable.
 */
import type { PlotRect } from './FieldLayer'
import type { RenderPoint } from './PointSystem'
import { tenureChargeToPlotXY } from './PointSystem'
import { subStep } from '../motion/scroll-scenes'
import { THRESHOLD } from '../motion/config'
import type { FeatureLens } from '../state/store'
import { logit, lerp } from '../lib/math'

export interface SceneCustomer {
  id: number
  tenure: number
  monthlyCharges: number
  p: number
  actualChurn: 0 | 1
  contract: string
  internetService: string
}

export interface SceneTargets {
  terrainAlpha: number
  contourAlpha: number
  points: RenderPoint[]
  cameraTarget: { scale: number; cx: number; cy: number }
}

const LENS_PALETTE: Record<string, [string, number][]> = {
  Contract: [
    ['Month-to-month', 1],
    ['One year', 0.35],
    ['Two year', 0.15],
  ],
}

function sampleGrid(grid: Float32Array | null, cols: number, rows: number, tenure: number, charge: number): number | null {
  if (!grid) return null
  const col = Math.round((tenure / 72) * (cols - 1))
  const row = Math.round((1 - (charge - 18.25) / (118.75 - 18.25)) * (rows - 1))
  const idx = Math.min(grid.length - 1, Math.max(0, row * cols + col))
  return grid[idx]
}

export function computeSceneTargets(
  beatIndex: number, // 0 hero, 1 data, 2 features, 3 boundary, 4 prediction, 5 explanation
  beatProgress: number,
  customers: SceneCustomer[],
  focalId: number,
  hoveredId: number | null,
  lens: FeatureLens,
  plot: PlotRect,
  grid: Float32Array | null,
  gridMeta: { cols: number; rows: number } | null
): SceneTargets {
  const points: RenderPoint[] = customers.map((c) => {
    const { px, py } = tenureChargeToPlotXY(c.tenure, c.monthlyCharges, plot)
    const isFocal = c.id === focalId
    const base: RenderPoint = {
      id: c.id,
      px,
      py,
      fill: 'ivory',
      alpha: 1,
      radius: 2.5,
      ringForActualChurn: c.actualChurn === 1,
      hovered: c.id === hoveredId,
      isFocal,
      grayHalo: false,
    }

    if (beatIndex <= 1) {
      // hero / data: uncolored population
      base.fill = 'ivory'
    } else if (beatIndex === 2) {
      // features: lens recolor (never mint/coral - reserved for model output)
      base.fill = 'ivory'
      if (lens === 'Contract') {
        const scheme = LENS_PALETTE.Contract.find(([v]) => v === c.contract)
        base.alpha = scheme ? scheme[1] : 0.35
      } else if (lens === 'InternetService') {
        base.alpha = c.internetService === 'DSL' ? 1 : c.internetService === 'Fiber optic' ? 0.6 : 0.3
      }
    } else if (beatIndex === 3) {
      const sub = subStep(beatProgress)
      base.fill = c.p >= THRESHOLD ? 'coral' : 'mint'
      if (sub === 0) {
        // on the threshold rail: x = logit(p) normalized, y = mid-band
        const nx = (logit(c.p) - logit(0.001)) / (logit(0.999) - logit(0.001))
        base.px = plot.x + nx * plot.width
        base.py = plot.y + plot.height * 0.5
      } else if (sub === 2 && grid && gridMeta) {
        const under = sampleGrid(grid, gridMeta.cols, gridMeta.rows, c.tenure, c.monthlyCharges)
        if (under != null) {
          const ownClass = c.p >= THRESHOLD
          const terrainClass = under >= THRESHOLD
          base.grayHalo = ownClass !== terrainClass
        }
      }
    } else if (beatIndex === 4) {
      base.fill = c.p >= THRESHOLD ? 'coral' : 'mint'
      base.alpha = isFocal ? 1 : 0.35
      base.radius = isFocal ? 2.5 : 2
    } else if (beatIndex === 5) {
      base.fill = c.p >= THRESHOLD ? 'coral' : 'mint'
      base.alpha = isFocal ? 1 : 0.25
      base.radius = isFocal ? 2.5 : 2
    }
    return base
  })

  let terrainAlpha = 0
  let contourAlpha = 0
  let cameraTarget = { scale: 1, cx: 0.5, cy: 0.5 }

  const focal = customers.find((c) => c.id === focalId)
  const focalNorm = focal ? { cx: focal.tenure / 72, cy: 1 - (focal.monthlyCharges - 18.25) / (118.75 - 18.25) } : { cx: 0.33, cy: 0.5 }

  if (beatIndex === 0) {
    terrainAlpha = 1
    contourAlpha = 1
    cameraTarget = { scale: 1.4, ...focalNorm }
  } else if (beatIndex === 1) {
    terrainAlpha = Math.max(0, 1 - beatProgress / 0.3)
    contourAlpha = terrainAlpha
    cameraTarget = { scale: lerp(1.4, 1, Math.min(1, beatProgress / 0.3)), ...focalNorm }
  } else if (beatIndex === 2) {
    terrainAlpha = 0
    contourAlpha = 0
    cameraTarget = { scale: 1, cx: 0.5, cy: 0.5 }
  } else if (beatIndex === 3) {
    const sub = subStep(beatProgress)
    terrainAlpha = sub === 0 ? 0 : 1
    contourAlpha = sub === 0 ? 0 : 1
    cameraTarget = sub === 0 ? { scale: 1, cx: 0.5, cy: 0.5 } : { scale: 1.2, ...focalNorm }
  } else if (beatIndex === 4) {
    terrainAlpha = 1
    contourAlpha = 1
    cameraTarget = { scale: 1.8, ...focalNorm }
  } else if (beatIndex === 5) {
    terrainAlpha = 0.3
    contourAlpha = 0.3
    cameraTarget = { scale: 1.8, ...focalNorm }
  }

  return { terrainAlpha, contourAlpha, points, cameraTarget }
}
