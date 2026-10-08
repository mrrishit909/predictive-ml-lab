/**
 * Points layer: the 400 real customers plus the focal crosshair
 * (composition.md z2). Owns each point's x/y/r/fill/alpha/ring. Provides
 * quadtree hit-testing (click/hover/touch-nearest-neighbor per
 * interaction-map.md) and never touches the terrain or DOM.
 */
import { quadtree as d3quadtree } from 'd3-quadtree'
import { PALETTE } from '../motion/config'
import type { PlotRect } from './FieldLayer'

export interface RenderPoint {
  id: number
  /** pixel-space position inside the plot rect. */
  px: number
  py: number
  fill: 'ivory' | 'mint' | 'coral'
  alpha: number
  radius: number
  ringForActualChurn: boolean
  hovered: boolean
  isFocal: boolean
  grayHalo: boolean // beat 3c "disagreement" halo
}

const FILL_COLOR: Record<RenderPoint['fill'], string> = {
  ivory: PALETTE.ivory70,
  mint: PALETTE.mint,
  coral: PALETTE.coral,
}

export function drawPoints(ctx: CanvasRenderingContext2D, points: RenderPoint[]) {
  for (const p of points) {
    ctx.save()
    ctx.globalAlpha = p.alpha
    ctx.beginPath()
    ctx.fillStyle = p.isFocal ? PALETTE.ivory : FILL_COLOR[p.fill]
    const r = p.hovered ? Math.max(p.radius, 4) : p.isFocal ? Math.max(p.radius, 5) : p.radius
    ctx.arc(p.px, p.py, r, 0, Math.PI * 2)
    ctx.fill()

    if (p.grayHalo) {
      ctx.beginPath()
      ctx.strokeStyle = PALETTE.gray
      ctx.lineWidth = 1
      ctx.arc(p.px, p.py, r + 3, 0, Math.PI * 2)
      ctx.stroke()
    }
    if (p.ringForActualChurn) {
      ctx.beginPath()
      ctx.strokeStyle = PALETTE.ivory
      ctx.lineWidth = 1
      ctx.arc(p.px, p.py, r + 2, 0, Math.PI * 2)
      ctx.stroke()
    }
    if (p.isFocal) {
      ctx.beginPath()
      ctx.strokeStyle = PALETTE.mint
      ctx.lineWidth = 2
      ctx.arc(p.px, p.py, r, 0, Math.PI * 2)
      ctx.stroke()
      // crosshair
      ctx.strokeStyle = PALETTE.mint
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(p.px - r - 6, p.py)
      ctx.lineTo(p.px - r - 2, p.py)
      ctx.moveTo(p.px + r + 2, p.py)
      ctx.lineTo(p.px + r + 6, p.py)
      ctx.moveTo(p.px, p.py - r - 6)
      ctx.lineTo(p.px, p.py - r - 2)
      ctx.moveTo(p.px, p.py + r + 2)
      ctx.lineTo(p.px, p.py + r + 6)
      ctx.stroke()
    }
    if (p.hovered && !p.isFocal) {
      ctx.beginPath()
      ctx.strokeStyle = PALETTE.ivory
      ctx.lineWidth = 1.5
      ctx.arc(p.px, p.py, r, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.restore()
  }
}

export function buildHitQuadtree(points: RenderPoint[]) {
  return d3quadtree<RenderPoint>()
    .x((p) => p.px)
    .y((p) => p.py)
    .addAll(points)
}

/** Nearest point within maxDist px (interaction-map.md: 22px touch / nearest-neighbor). */
export function findNearest(
  qt: ReturnType<typeof buildHitQuadtree>,
  x: number,
  y: number,
  maxDist = 22
): RenderPoint | null {
  const found = qt.find(x, y, maxDist)
  return found ?? null
}

export function tenureChargeToPlotXY(tenure: number, monthlyCharges: number, plot: PlotRect): { px: number; py: number } {
  const px = plot.x + (tenure / 72) * plot.width
  const py = plot.y + (1 - (monthlyCharges - 18.25) / (118.75 - 18.25)) * plot.height
  return { px, py }
}
