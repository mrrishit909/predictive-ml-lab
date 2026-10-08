import { useEffect, useRef, useState } from 'react'

/** Decision-boundary opening motion: customer points scatter, separate into
 * two colored regions (churn / stay), then the camera zooms toward one
 * selected churn point (scale + translate around it so it fills the frame)
 * before the whole overlay fades, revealing the real prediction form
 * underneath - a camera move + morph, not a plain cut. Respects
 * prefers-reduced-motion. */
export default function Intro({ onDone }: { onDone: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [fading, setFading] = useState(false)
  const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  useEffect(() => {
    if (reduced) {
      onDone()
      return
    }
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    const w = (canvas.width = window.innerWidth)
    const h = (canvas.height = window.innerHeight)
    const N = 140
    const points = Array.from({ length: N }, (_, i) => ({
      x: Math.random() * w,
      y: Math.random() * h,
      tx: 0,
      ty: 0,
      churn: Math.random() < 0.35,
      isTarget: false,
      id: i,
    }))
    points.forEach((p) => {
      p.tx = p.churn ? w * 0.72 + (Math.random() - 0.5) * w * 0.22 : w * 0.28 + (Math.random() - 0.5) * w * 0.22
      p.ty = h * 0.5 + (Math.random() - 0.5) * h * 0.5
    })
    // Target: one churn point near where the real prediction-result panel
    // sits in the mounted layout, so the camera move lands where the UI is.
    const target = points.filter((p) => p.churn)[0] ?? points[0]
    target.isTarget = true
    target.tx = w * 0.72
    target.ty = h * 0.4

    let start: number | null = null
    const SCATTER_MS = 1400
    const HOLD_MS = 500
    const ZOOM_MS = 1300
    const TOTAL_MS = SCATTER_MS + HOLD_MS + ZOOM_MS
    const FADE_START_MS = TOTAL_MS - 500
    let raf = 0
    let firedFade = false

    function frame(t: number) {
      if (start === null) start = t
      const elapsed = t - start!

      ctx.fillStyle = '#0B1110'
      ctx.fillRect(0, 0, w, h)

      if (elapsed < SCATTER_MS) {
        const ease = 1 - Math.pow(1 - elapsed / SCATTER_MS, 3)
        if (elapsed > SCATTER_MS * 0.6) {
          ctx.strokeStyle = 'rgba(181,255,206,0.15)'
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.moveTo(w / 2, 0)
          ctx.lineTo(w / 2, h)
          ctx.stroke()
        }
        for (const p of points) {
          const x = p.x + (p.tx - p.x) * ease
          const y = p.y + (p.ty - p.y) * ease
          ctx.beginPath()
          ctx.arc(x, y, p.isTarget ? 6 : 4, 0, Math.PI * 2)
          ctx.fillStyle = p.churn ? '#FF866D' : '#B5FFCE'
          ctx.fill()
        }
      } else if (elapsed < SCATTER_MS + HOLD_MS) {
        for (const p of points) {
          ctx.beginPath()
          ctx.arc(p.tx, p.ty, p.isTarget ? 7 : 4, 0, Math.PI * 2)
          ctx.fillStyle = p.churn ? '#FF866D' : '#B5FFCE'
          ctx.fill()
        }
        ctx.strokeStyle = '#FF866D'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(target.tx, target.ty, 16, 0, Math.PI * 2)
        ctx.stroke()
      } else {
        // Camera zooms toward the target point: scale the scene up around it.
        const zoomProg = Math.min(1, (elapsed - SCATTER_MS - HOLD_MS) / ZOOM_MS)
        const ease = zoomProg * zoomProg
        const scale = 1 + ease * 22
        ctx.save()
        ctx.translate(target.tx, target.ty)
        ctx.scale(scale, scale)
        ctx.translate(-target.tx, -target.ty)
        for (const p of points) {
          if (!p.isTarget && ease > 0.35) continue // other points leave frame as we zoom in
          ctx.beginPath()
          ctx.arc(p.tx, p.ty, p.isTarget ? 7 : 4, 0, Math.PI * 2)
          ctx.fillStyle = p.churn ? '#FF866D' : '#B5FFCE'
          ctx.fill()
        }
        ctx.restore()
      }

      if (!firedFade && elapsed >= FADE_START_MS) {
        firedFade = true
        setFading(true)
        setTimeout(onDone, 520)
      }
      if (elapsed < TOTAL_MS) {
        raf = requestAnimationFrame(frame)
      }
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [onDone, reduced])

  if (reduced) return null

  return (
    <div
      className="fixed inset-0 bg-[#0B1110] z-50 transition-opacity duration-500"
      style={{ opacity: fading ? 0 : 1, pointerEvents: fading ? 'none' : 'auto' }}
    >
      <canvas ref={canvasRef} className="w-full h-full" />
      <button
        onClick={() => { setFading(true); setTimeout(onDone, 300) }}
        className="absolute bottom-6 right-6 text-sm text-[#F0F3EB]/60 hover:text-[#B5FFCE] underline"
      >
        skip intro
      </button>
    </div>
  )
}
