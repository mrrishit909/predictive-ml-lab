import { useEffect, useRef, useState } from 'react'

/** Decision-boundary opening motion: customer points scatter, separate into
 * two colored regions (churn / stay), then the camera "moves toward" one
 * point and the whole canvas fades into the app. Respects prefers-reduced-motion. */
export default function Intro({ onDone }: { onDone: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [skip, setSkip] = useState(false)
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
    const points = Array.from({ length: N }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      tx: 0,
      ty: 0,
      churn: Math.random() < 0.35,
    }))
    points.forEach((p) => {
      p.tx = p.churn ? w * 0.72 + (Math.random() - 0.5) * w * 0.22 : w * 0.28 + (Math.random() - 0.5) * w * 0.22
      p.ty = h * 0.5 + (Math.random() - 0.5) * h * 0.5
    })

    let start: number | null = null
    const DURATION = 2200
    let raf = 0

    function frame(t: number) {
      if (start === null) start = t
      const elapsed = t - start!
      const prog = Math.min(1, elapsed / DURATION)
      const ease = 1 - Math.pow(1 - prog, 3)

      ctx.fillStyle = '#0B1110'
      ctx.fillRect(0, 0, w, h)

      if (prog > 0.35) {
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
        ctx.arc(x, y, 4, 0, Math.PI * 2)
        ctx.fillStyle = p.churn ? '#FF866D' : '#B5FFCE'
        ctx.fill()
      }

      if (prog < 1) {
        raf = requestAnimationFrame(frame)
      } else {
        setTimeout(onDone, 350)
      }
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [onDone, reduced])

  if (reduced) return null

  return (
    <div className="fixed inset-0 bg-[#0B1110] z-50">
      <canvas ref={canvasRef} className="w-full h-full" />
      <button
        onClick={() => { setSkip(true); onDone() }}
        className="absolute bottom-6 right-6 text-sm text-[#F0F3EB]/60 hover:text-[#B5FFCE] underline"
      >
        skip intro
      </button>
      {skip && null}
    </div>
  )
}
