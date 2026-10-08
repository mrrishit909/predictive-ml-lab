/**
 * Camera: owns the canvas transform (scale, tx, ty) - composition.md z-stack,
 * motion-bible property ownership. Never touches point data or the DOM.
 * Chases a target with the `spring.camera` token via the shared Spring
 * primitive in motion/timelines.ts.
 */
import { Spring } from '../motion/timelines'
import { SPRING } from '../motion/config'

export interface CameraTarget {
  scale: number
  /** focal point in plot-normalized coordinates [0,1]. */
  cx: number
  cy: number
}

export class Camera {
  scaleSpring: Spring
  cxSpring: Spring
  cySpring: Spring

  constructor(initial: CameraTarget) {
    this.scaleSpring = new Spring(initial.scale, SPRING.camera.k, SPRING.camera.c)
    this.cxSpring = new Spring(initial.cx, SPRING.camera.k, SPRING.camera.c)
    this.cySpring = new Spring(initial.cy, SPRING.camera.k, SPRING.camera.c)
  }

  setTarget(t: CameraTarget) {
    this.scaleSpring.setTarget(t.scale)
    this.cxSpring.setTarget(t.cx)
    this.cySpring.setTarget(t.cy)
  }

  snap(t: CameraTarget) {
    this.scaleSpring.snap(t.scale)
    this.cxSpring.snap(t.cx)
    this.cySpring.snap(t.cy)
  }

  step(dt: number) {
    this.scaleSpring.step(dt)
    this.cxSpring.step(dt)
    this.cySpring.step(dt)
  }

  get settled(): boolean {
    return this.scaleSpring.settled && this.cxSpring.settled && this.cySpring.settled
  }

  get current(): CameraTarget {
    return { scale: this.scaleSpring.value, cx: this.cxSpring.value, cy: this.cySpring.value }
  }

  /** Applies the camera transform to a canvas context, centered within `plot`. */
  apply(ctx: CanvasRenderingContext2D, plot: { x: number; y: number; width: number; height: number }) {
    const { scale, cx, cy } = this.current
    const focusPxX = plot.x + cx * plot.width
    const focusPxY = plot.y + cy * plot.height
    ctx.translate(focusPxX, focusPxY)
    ctx.scale(scale, scale)
    ctx.translate(-focusPxX, -focusPxY)
  }
}
