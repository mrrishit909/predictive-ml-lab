/**
 * Draws the terrain (probability field) and its iso-line contours onto a
 * canvas 2D context. Owns terrain pixels/alpha/contour paths, per
 * composition.md's layer stack (z0 terrain, z1 contours) and motion-bible's
 * property-ownership table. Never touches points or DOM.
 */
import { contours as d3contours } from 'd3-contour'
import { terrainColor, ISO_LEVELS } from './colorRamp'
import { PALETTE, THRESHOLD } from '../motion/config'

export interface PlotRect {
  x: number
  y: number
  width: number
  height: number
}

/** Builds the small cols x rows ImageData from real grid probabilities, one real inference per cell. */
export function gridToImageData(grid: Float32Array, cols: number, rows: number): ImageData {
  const img = new ImageData(cols, rows)
  for (let i = 0; i < cols * rows; i++) {
    const [r, g, b] = terrainColor(grid[i])
    img.data[i * 4] = r
    img.data[i * 4 + 1] = g
    img.data[i * 4 + 2] = b
    img.data[i * 4 + 3] = 255
  }
  return img
}

/** Draws the bilinear-upscaled terrain field into `plot`, at the given alpha (crossfade owner: caller tweens this). */
export function drawField(
  ctx: CanvasRenderingContext2D,
  offscreen: OffscreenCanvas | HTMLCanvasElement,
  img: ImageData,
  plot: PlotRect,
  alpha: number
) {
  if (alpha <= 0) return
  const small = offscreen.getContext('2d') as CanvasRenderingContext2D | null
  if (!small) return
  offscreen.width = img.width
  offscreen.height = img.height
  small.putImageData(img, 0, 0)
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.imageSmoothingEnabled = true
  ctx.drawImage(offscreen as CanvasImageSource, plot.x, plot.y, plot.width, plot.height)
  ctx.restore()
}

/** Whether the 0.10 contour exists in this slice (174/400 customers have none, per art-direction.md). */
export function hasThresholdContour(grid: Float32Array): boolean {
  let min = Infinity
  let max = -Infinity
  for (const v of grid) {
    if (v < min) min = v
    if (v > max) max = v
  }
  return min < THRESHOLD && max >= THRESHOLD
}

const ISO_STYLE: Record<number, { color: string; width: number; dash?: number[]; glow?: string }> = {
  0.05: { color: PALETTE.mint40, width: 1, dash: [2, 4] },
  0.1: { color: PALETTE.coral, width: 1.5, glow: PALETTE.coral16 },
  0.25: { color: PALETTE.ivory35, width: 1 },
  0.5: { color: PALETTE.ivory35, width: 1 },
}

/** Draws the 0.05/0.10/0.25/0.50 iso-lines, traced from the real grid by d3-contour - nobody draws the boundary by hand. */
export function drawContours(ctx: CanvasRenderingContext2D, grid: Float32Array, cols: number, rows: number, plot: PlotRect, alpha: number) {
  if (alpha <= 0) return
  const gen = d3contours().size([cols, rows]).thresholds(ISO_LEVELS as unknown as number[])
  const multiPolygons = gen(Array.from(grid))

  ctx.save()
  ctx.globalAlpha = alpha
  for (const mp of multiPolygons) {
    const style = ISO_STYLE[mp.value as number]
    if (!style) continue
    ctx.beginPath()
    for (const polygon of mp.coordinates) {
      for (const ring of polygon) {
        ring.forEach(([gx, gy], i: number) => {
          // d3-contour's coordinate space is [0,cols] x [0,rows] (cell i,j centered at i+0.5,j+0.5).
          const px = plot.x + (gx / cols) * plot.width
          const py = plot.y + (gy / rows) * plot.height
          if (i === 0) ctx.moveTo(px, py)
          else ctx.lineTo(px, py)
        })
      }
    }
    if (style.glow) {
      ctx.save()
      ctx.shadowColor = style.glow
      ctx.shadowBlur = 6
    }
    ctx.strokeStyle = style.color
    ctx.lineWidth = style.width
    ctx.setLineDash(style.dash ?? [])
    ctx.stroke()
    if (style.glow) ctx.restore()
  }
  ctx.restore()
}
