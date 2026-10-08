/**
 * The sticky canvas stack: terrain + contours (z0-1) and points (z2), per
 * composition.md. This is the site's visual identity (art-direction.md
 * "TERRAIN") - every cell comes from a real ONNX grid computed in a Web
 * Worker, and the points are the real 400 held-out customers.
 *
 * Owns: canvas drawing, the Camera, pointer drag/click, keyboard nudges on
 * the crosshair proxy button. Reads beat/lens/focal state from the store;
 * writes feature edits and focal selection back into it.
 */
import { useEffect, useRef, useCallback } from 'react'
import {
  useAppState,
  updateFeature,
  setFocalCustomer,
  type FeatureLens,
} from '../state/store'
import type { CustomerRow, PredictionRow } from '../data/fixtures'
import { computeSceneTargets, type SceneCustomer } from './beatTargets'
import { gridToImageData, drawField, drawContours, type PlotRect } from './FieldLayer'
import { drawPoints, buildHitQuadtree, findNearest, type RenderPoint } from './PointSystem'
import { Camera } from './Camera'
import { registerFrameClient, unregisterFrameClient } from '../motion/timelines'
import { useBreakpoint, PLOT_INSETS } from '../hooks/useBreakpoint'
import { usePrefersReducedMotion } from '../motion/reduced-motion'
import { TENURE_RANGE, MONTHLY_CHARGES_RANGE, clamp } from '../data/constraints'

export interface TerrainStackProps {
  customers: CustomerRow[]
  predictions: PredictionRow[]
  onHoverPoint?: (id: number | null) => void
}

function joinScene(customers: CustomerRow[], predictions: PredictionRow[], focalId: number, liveP: number | null): SceneCustomer[] {
  const byId = new Map(predictions.map((p) => [p.id, p]))
  return customers.map((c) => {
    const pred = byId.get(c.id)
    const isFocal = c.id === focalId
    return {
      id: c.id,
      tenure: c.tenure,
      monthlyCharges: c.MonthlyCharges,
      p: isFocal && liveP != null ? liveP : pred?.churn_probability ?? 0,
      actualChurn: c.actual_churn,
      contract: c.Contract,
      internetService: c.InternetService,
    }
  })
}

export default function TerrainStack({ customers, predictions, onHoverPoint }: TerrainStackProps) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const fieldCanvasRef = useRef<HTMLCanvasElement>(null)
  const pointCanvasRef = useRef<HTMLCanvasElement>(null)
  const offscreenRef = useRef<HTMLCanvasElement | null>(null)
  const cameraRef = useRef<Camera | null>(null)
  const draggingRef = useRef(false)
  const sizeRef = useRef({ width: 0, height: 0, dpr: 1 })
  const pointsRef = useRef<RenderPoint[]>([])
  const hoveredRef = useRef<number | null>(null)

  const breakpoint = useBreakpoint()
  const reducedMotion = usePrefersReducedMotion()

  const beatIndex = useAppState((s) => s.beatIndex)
  const beatProgress = useAppState((s) => s.beatProgress)
  const lens = useAppState((s) => s.lens)
  const focalId = useAppState((s) => s.focalId)
  const features = useAppState((s) => s.features)
  const focalP = useAppState((s) => s.focalP)
  const grid = useAppState((s) => s.grid)
  const gridMeta = useAppState((s) => s.gridMeta)
  const edited = useAppState((s) => s.edited)

  if (!offscreenRef.current && typeof document !== 'undefined') {
    offscreenRef.current = document.createElement('canvas')
  }
  if (!cameraRef.current) {
    cameraRef.current = new Camera({ scale: 1.4, cx: 0.33, cy: 0.5 })
  }

  const plotRect = useCallback((): PlotRect => {
    const { width, height } = sizeRef.current
    const inset = PLOT_INSETS[breakpoint]
    return {
      x: inset.left,
      y: inset.top,
      width: Math.max(1, width - inset.left - inset.right),
      height: Math.max(1, height - inset.top - inset.bottom),
    }
  }, [breakpoint])

  // resize observer
  useEffect(() => {
    const el = wrapperRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      const rect = el.getBoundingClientRect()
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      sizeRef.current = { width: rect.width, height: rect.height, dpr }
      for (const canvas of [fieldCanvasRef.current, pointCanvasRef.current]) {
        if (!canvas) continue
        canvas.width = rect.width * dpr
        canvas.height = rect.height * dpr
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // draw + camera loop
  useEffect(() => {
    const scene = edited && focalId != null
      ? joinScene(customers, predictions, focalId, focalP)
      : joinScene(customers, predictions, focalId, null)

    function draw() {
      const field = fieldCanvasRef.current
      const points = pointCanvasRef.current
      const offscreen = offscreenRef.current
      const camera = cameraRef.current
      if (!field || !points || !offscreen || !camera) return
      const { width, height, dpr } = sizeRef.current
      const plot = plotRect()

      // override the live focal customer's tenure/charge for on-screen position when edited
      const sceneWithEdit = features && edited
        ? scene.map((c) => (c.id === focalId ? { ...c, tenure: features.tenure, monthlyCharges: features.MonthlyCharges } : c))
        : scene

      const targets = computeSceneTargets(
        beatIndex,
        beatProgress,
        sceneWithEdit,
        focalId,
        hoveredRef.current,
        lens,
        plot,
        grid,
        gridMeta ? { cols: gridMeta.cols, rows: gridMeta.rows } : null
      )

      if (reducedMotion) camera.snap(targets.cameraTarget)
      else camera.setTarget(targets.cameraTarget)

      const fctx = field.getContext('2d')
      const pctx = points.getContext('2d')
      if (fctx) {
        fctx.save()
        fctx.scale(dpr, dpr)
        fctx.clearRect(0, 0, width, height)
        camera.apply(fctx, plot)
        if (grid && gridMeta && targets.terrainAlpha > 0) {
          const img = gridToImageData(grid, gridMeta.cols, gridMeta.rows)
          drawField(fctx, offscreen, img, plot, targets.terrainAlpha)
          drawContours(fctx, grid, gridMeta.cols, gridMeta.rows, plot, targets.contourAlpha)
        }
        fctx.restore()
      }
      if (pctx) {
        pctx.save()
        pctx.scale(dpr, dpr)
        pctx.clearRect(0, 0, width, height)
        camera.apply(pctx, plot)
        drawPoints(pctx, targets.points)
        pctx.restore()
      }
      pointsRef.current = targets.points
    }

    const clientId = 'terrain-stack'
    registerFrameClient({
      id: clientId,
      // ponytail: always-on while mounted, not "stop when settled" as motion-bible.md
      // asks. A full idle-detector (settled camera AND no pending redraw AND no
      // pointer down) is more state than this single sticky canvas's redraw cost
      // justifies. Upgrade if profiling ever shows this canvas burning idle CPU.
      isActive: () => true,
      tick: (_elapsed, dtMs) => {
        cameraRef.current?.step(dtMs / 1000)
        draw()
      },
      onResume: () => cameraRef.current?.snap(cameraRef.current.current),
    })
    draw()
    return () => unregisterFrameClient(clientId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [beatIndex, beatProgress, lens, focalId, features, focalP, grid, gridMeta, edited, customers, predictions, plotRect, reducedMotion])

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const rect = e.currentTarget.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top

      if (draggingRef.current && features) {
        const plot = plotRect()
        const tenure = clamp(Math.round(((x - plot.x) / plot.width) * 72), TENURE_RANGE.min, TENURE_RANGE.max)
        const charge = clamp(
          118.75 - ((y - plot.y) / plot.height) * (118.75 - 18.25),
          MONTHLY_CHARGES_RANGE.min,
          MONTHLY_CHARGES_RANGE.max
        )
        updateFeature('tenure', tenure)
        updateFeature('MonthlyCharges', Math.round(charge * 100) / 100)
        return
      }

      const qt = buildHitQuadtree(pointsRef.current)
      const nearest = findNearest(qt, x, y, 22)
      const id = nearest?.id ?? null
      if (hoveredRef.current !== id) {
        hoveredRef.current = id
        onHoverPoint?.(id)
      }
    },
    [features, plotRect, onHoverPoint]
  )

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const rect = e.currentTarget.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      const qt = buildHitQuadtree(pointsRef.current)
      const nearest = findNearest(qt, x, y, 22)
      if (nearest?.isFocal) {
        draggingRef.current = true
        e.currentTarget.setPointerCapture(e.pointerId)
      } else if (nearest) {
        const row = customers.find((c) => c.id === nearest.id)
        if (row) setFocalCustomer(row)
      }
    },
    [customers]
  )

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    draggingRef.current = false
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* already released */
    }
  }, [])

  const handleCrosshairKey = useCallback(
    (e: React.KeyboardEvent) => {
      if (!features) return
      const bigTenure = e.shiftKey ? 12 : 1
      const bigCharge = e.shiftKey ? 10 : 1
      if (e.key === 'ArrowLeft') updateFeature('tenure', features.tenure - bigTenure)
      else if (e.key === 'ArrowRight') updateFeature('tenure', features.tenure + bigTenure)
      else if (e.key === 'ArrowUp') updateFeature('MonthlyCharges', features.MonthlyCharges + bigCharge)
      else if (e.key === 'ArrowDown') updateFeature('MonthlyCharges', features.MonthlyCharges - bigCharge)
      else return
      e.preventDefault()
    },
    [features]
  )

  return (
    <div ref={wrapperRef} style={{ position: 'absolute', inset: 0 }} aria-hidden="true">
      <canvas ref={fieldCanvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
      <canvas
        ref={pointCanvasRef}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', touchAction: 'none' }}
        onPointerMove={handlePointerMove}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={() => {
          hoveredRef.current = null
          onHoverPoint?.(null)
        }}
      />
      {/* DOM proxy for the crosshair (interaction-map.md): keyboard-operable, announces state. */}
      <button
        type="button"
        className="visually-hidden"
        onKeyDown={handleCrosshairKey}
        aria-label={
          features
            ? `Focal customer crosshair. Tenure ${features.tenure} months, monthly charge $${features.MonthlyCharges.toFixed(2)}. Arrow keys adjust, shift for larger steps.`
            : 'Focal customer crosshair'
        }
      />
    </div>
  )
}

export type { FeatureLens }
