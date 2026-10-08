/**
 * The shared timer loop and the damped spring primitive that
 * FieldLayer/PointSystem/Camera run inside (motion-bible.md "Property
 * ownership": "each update inside one shared d3.timer callback... a single
 * rAF loop for the whole canvas stack, and it stops when nothing is
 * settling and no input is active").
 *
 * d3 has no spring primitive; this is the ~10-line semi-implicit-Euler
 * critically-damped spring the motion bible asks the engineer to add.
 */
import { timer as d3timer, type Timer } from 'd3-timer'

export class Spring {
  value: number
  target: number
  velocity = 0
  readonly k: number
  readonly c: number

  constructor(initial: number, k: number, c: number) {
    this.value = initial
    this.target = initial
    this.k = k
    this.c = c
  }

  setTarget(t: number) {
    this.target = t
  }

  /** Tab was hidden for >100ms, or reduced-motion: jump instantly, never integrate a huge dt. */
  snap(target = this.target) {
    this.value = target
    this.target = target
    this.velocity = 0
  }

  /** Semi-implicit Euler step, dt in seconds. */
  step(dt: number): number {
    const dtClamped = Math.min(dt, 1 / 15) // never integrate more than one slow frame
    const force = -this.k * (this.value - this.target) - this.c * this.velocity
    this.velocity += force * dtClamped
    this.value += this.velocity * dtClamped
    return this.value
  }

  get settled(): boolean {
    return Math.abs(this.target - this.value) < 0.001 && Math.abs(this.velocity) < 0.001
  }
}

interface FrameClient {
  id: string
  isActive: () => boolean
  tick: (elapsedMs: number, dtMs: number) => void
  /** called when the tab was hidden for >100ms: snap everything to target. */
  onResume?: () => void
}

const clients = new Map<string, FrameClient>()
let timer: Timer | null = null
let lastElapsed = 0
let hiddenAt: number | null = null

function loop(elapsed: number) {
  const dt = elapsed - lastElapsed
  lastElapsed = elapsed
  let anyActive = false
  for (const client of clients.values()) {
    if (client.isActive()) {
      anyActive = true
      client.tick(elapsed, dt)
    }
  }
  if (!anyActive) stopLoop()
}

function stopLoop() {
  timer?.stop()
  timer = null
}

function ensureRunning() {
  if (timer) return
  lastElapsed = 0
  timer = d3timer(loop)
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      hiddenAt = performance.now()
    } else if (hiddenAt !== null) {
      const hiddenMs = performance.now() - hiddenAt
      hiddenAt = null
      if (hiddenMs > 100) {
        for (const c of clients.values()) c.onResume?.()
      }
    }
  })
}

export function registerFrameClient(client: FrameClient) {
  clients.set(client.id, client)
  ensureRunning()
}

export function unregisterFrameClient(id: string) {
  clients.delete(id)
  if (clients.size === 0) stopLoop()
}

/** Wakes the shared loop, e.g. right after setTarget() on a spring that was settled. */
export function wakeFrameLoop() {
  ensureRunning()
}
