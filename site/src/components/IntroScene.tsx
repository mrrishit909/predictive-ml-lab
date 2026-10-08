/**
 * The 10s intro (scroll-storyboard.md). Draws motion/intro.ts's
 * deterministic frameAt() output to a full-bleed canvas. Skippable at any
 * time (Esc or the Skip button); auto-skips on return visits via
 * sessionStorage (readIntroSeen).
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { prepareIntro, frameAt, normalizedLogit, INTRO_DURATION_S, type IntroPlan, type IntroRow } from '../motion/intro'
import { THRESHOLD } from '../motion/config'
import { PALETTE } from '../motion/config'
import SkipIntro from './SkipIntro'
import {
  usePrefersReducedMotion,
  REDUCED_INTRO_FRAMES,
  REDUCED_INTRO_FRAME_HOLD_MS,
} from '../motion/reduced-motion'
import type { Fixtures } from '../data/fixtures'
import { DEFAULT_FOCAL_ID } from '../data/fixtures'
import { markIntroSeen } from '../state/store'

export default function IntroScene({ fixtures, onDone }: { fixtures: Fixtures; onDone: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const planRef = useRef<IntroPlan | null>(null)
  const startRef = useRef<number | null>(null)
  const reducedMotion = usePrefersReducedMotion()
  const [reducedFrameIndex, setReducedFrameIndex] = useState(0)
  const doneRef = useRef(false)

  useEffect(() => {
    const rows: IntroRow[] = fixtures.customers.map((c) => {
      const pred = fixtures.predictions.find((p) => p.id === c.id)!
      return { id: c.id, p: pred.churn_probability, tenure: c.tenure, monthlyCharges: c.MonthlyCharges, actualChurn: c.actual_churn }
    })
    planRef.current = prepareIntro(rows, DEFAULT_FOCAL_ID)
  }, [fixtures])

  const finish = useCallback(() => {
    if (doneRef.current) return
    doneRef.current = true
    markIntroSeen()
    onDone()
  }, [onDone])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') finish()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [finish])

  useEffect(() => {
    if (reducedMotion) return
    let raf: number
    function tick(now: number) {
      if (startRef.current == null) startRef.current = now
      const t = (now - startRef.current) / 1000
      if (t >= INTRO_DURATION_S) {
        finish()
        return
      }
      draw(t)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reducedMotion, finish])

  useEffect(() => {
    if (!reducedMotion) return
    if (reducedFrameIndex >= REDUCED_INTRO_FRAMES.length) {
      finish()
      return
    }
    const id = setTimeout(() => setReducedFrameIndex((i) => i + 1), REDUCED_INTRO_FRAME_HOLD_MS)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reducedMotion, reducedFrameIndex, finish])

  function draw(t: number) {
    const canvas = canvasRef.current
    const plan = planRef.current
    if (!canvas || !plan) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    canvas.width = w * dpr
    canvas.height = h * dpr
    ctx.save()
    ctx.scale(dpr, dpr)
    ctx.fillStyle = PALETTE.bg
    ctx.fillRect(0, 0, w, h)

    const frame = frameAt(plan, t, false /* model-ready gating simplified: terrain appears post-intro in Hero */)
    for (const p of frame.points) {
      ctx.save()
      ctx.globalAlpha = p.alpha
      ctx.beginPath()
      ctx.fillStyle = p.isFocal ? PALETTE.ivory : p.color === 'mint' ? PALETTE.mint : p.color === 'coral' ? PALETTE.coral : PALETTE.ivory70
      ctx.arc(p.x * w, p.y * h, p.isFocal ? 4 : 2, 0, Math.PI * 2)
      ctx.fill()
      if (p.ringForActualChurn) {
        ctx.strokeStyle = PALETTE.ivory
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.arc(p.x * w, p.y * h, 4, 0, Math.PI * 2)
        ctx.stroke()
      }
      ctx.restore()
    }
    if (frame.showThresholdRule) {
      const x = normalizedLogit(THRESHOLD) * w // the real rail position of p=0.10, not an approximation
      ctx.strokeStyle = PALETTE.coral
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, h)
      ctx.stroke()
    }
    ctx.fillStyle = PALETTE.ivory
    ctx.font = '600 20px "Bricolage Grotesque Variable", sans-serif'
    ctx.fillText(frame.caption, 32, h - 64)
    ctx.font = '400 13px "JetBrains Mono Variable", monospace'
    ctx.fillStyle = PALETTE.gray
    ctx.fillText(frame.evidence, 32, h - 40)
    ctx.restore()
  }

  // reduced-motion: draw one static frame per step
  useEffect(() => {
    if (!reducedMotion) return
    const plan = planRef.current
    if (!plan) return
    const stepTimes = { rail: 4.5, plane: 6.5, hero: 9.5 }
    draw(stepTimes[REDUCED_INTRO_FRAMES[Math.min(reducedFrameIndex, REDUCED_INTRO_FRAMES.length - 1)]])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reducedMotion, reducedFrameIndex, fixtures])

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--bg)', zIndex: 50 }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
      <SkipIntro onSkip={finish} />
      <p className="visually-hidden">
        Intro animation: 400 customers the model never saw, 200 shown drifting, then arranging by churn probability
        around the 0.10 threshold, then unfolding into the tenure-by-monthly-charge plane with customer #276&rsquo;s
        probability terrain. Press Skip intro or Escape to continue.
      </p>
    </div>
  )
}
