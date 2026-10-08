# Motion bible (approved)

This document is the source of truth for `site/src/motion/config.ts` and the few motion primitives beside it. The engineer turns the tables below into constants. **No duration or easing is ever written inline in a component.**

## Philosophy

1. **Motion encodes a state change, never decoration.** If a property animates, the data, the camera or the narrative state changed. This is Distill's rule. The terrain never shimmers, breathes or drifts on its own.
2. **Damped and physical, never bouncy.** Positions settle like a well-damped needle. There is no overshoot on data marks, ever. Overshoot would imply a probability that the model did not produce.
3. **Scroll drives progress, and progress drives state.** Scroll is never hijacked, snapped or smoothed. Smoothing applies only to the visual's catch-up toward the scroll-derived target. This is the architecture of ScrollTrigger's numeric `scrub`.
4. **The model's latency is honest.** When inference is running, the UI shows it with the ledger and a 1px progress hairline. The UI never hides latency behind a fake animation, and it never delays a ready result to make it look "computed".
5. **One owner per animated property.** Two systems never write the same property. See the table below.

## Dependencies

- **No new animation dependency.** GSAP is not installed and is not needed.
- Use what is already in `package.json`: `d3` 7.9, specifically `d3-ease`, `d3-timer`, `d3-interpolate`, `d3-scale`, `d3-contour`, `d3-quadtree` and `d3-random`.
- Add `IntersectionObserver` and CSS `position: sticky` and transitions.
- The one primitive d3 lacks is a critically damped spring. It is about 10 lines (semi-implicit Euler, `c = 2√k`).

## Timing tokens (ms)

| Token | Value | Use |
|---|---|---|
| `instant` | 0 | reduced-motion replacement for anything positional |
| `micro` | 120 | hover states, focus ring, live-dot pulse leg |
| `short` | 200 | control state change, tooltip in/out, number tick |
| `field` | 160 | terrain crossfade between two computed grids (old to new) |
| `medium` | 360 | caption enter/exit, rail expand/collapse |
| `long` | 600 | point re-layout between beats (spring target change), camera pan within a beat |
| `scene` | 900 | camera zoom into or out of the focal customer |
| `intro` | 10,000 | total intro timeline (see the storyboard), skippable at any time |

**Stagger.** Point re-layouts stagger by **rank** (sorted by the destination x), at 0.6 ms per point. That is about 240 ms of total spread across 400 points. It reads as a sweep, not as noise. The stagger is never random.

## Springs (positional data marks)

| Token | k (stiffness) | c (damping) | ζ | ~settle | Use |
|---|---|---|---|---|---|
| `spring.point` | 170 | 26.1 | 1.0 | 420 ms | point x/y between layouts |
| `spring.focal` | 300 | 34.6 | 1.0 | 300 ms | focal crosshair following a drag (tight, near-1:1) |
| `spring.camera` | 90 | 19.0 | 1.0 | 650 ms | camera scale/translate catch-up to the scroll target |

All springs are critically damped (ζ = 1), which gives no overshoot by construction. On a tab hidden for more than 100ms, snap everything to its target. Never integrate a huge dt.

## Easing curves (time-based tweens)

| Token | CSS | d3 equivalent | Use |
|---|---|---|---|
| `ease.out` | `cubic-bezier(0.16, 1, 0.3, 1)` | `d3.easeExpOut` | elements arriving: captions, rail, tooltips |
| `ease.in` | `cubic-bezier(0.7, 0, 0.84, 0)` | `d3.easeExpIn` | elements leaving (always shorter: 0.66× the enter duration) |
| `ease.inOut` | `cubic-bezier(0.65, 0, 0.35, 1)` | `d3.easeCubicInOut` | intro camera moves, axis to terrain unfold |
| `ease.linear` | `linear` | `d3.easeLinear` | scroll progress mapping, contour line draw-on, row-by-row terrain reveal |
| `ease.number` | `cubic-bezier(0.2, 0, 0, 1)` | `d3.easeQuadOut` | number ticker interpolation |

## Property ownership

| System | Owns (writes) | Never touches |
|---|---|---|
| `ScrollController` | `beatIndex`, `beatProgress` (0..1) in a store | any visual property directly |
| `Camera` | canvas transform: `scale`, `tx`, `ty` | point data, DOM |
| `FieldLayer` | terrain pixels, terrain alpha, contour paths/alpha | points, camera |
| `PointSystem` | each point's `x, y, r, fill, alpha, ring` | terrain, DOM |
| `NumberTicker` | `textContent` of LIVE/FIXTURE numerals | layout, color |
| CSS transitions | DOM `opacity` and `transform` only (captions, rail, tooltips, overlay) | `width`/`height`/`top`/`left` (no layout properties) |
| `InferenceClient` (worker) | nothing visual; it emits `{grid, focalP, folds[], ms, rows}` | everything visual |

`FieldLayer`, `PointSystem` and `Camera` each update inside **one** shared `d3.timer` callback. There is a single rAF loop for the whole canvas stack, and it **stops** when nothing is settling and no input is active.

## Number ticker

- LIVE probabilities tween from the old value to the new one over `short` (200 ms) with `ease.number`. They display 3 decimals at every frame.
- If a new inference lands mid-tween, retarget from the current displayed value. Never queue.
- **Crossing the threshold** fires two things on the frame where the *displayed* value crosses 0.10:
  - the color swap (coral and mint, 120 ms);
  - one 1px hairline pulse on the mini threshold rail.
- No sound and no shake.

## Terrain updates

- A new grid arrives, then the old ImageData and the new one crossfade over `field` (160 ms).
- The contours do not tween their geometry. Interpolating between two iso-line sets is not meaningful. The old contours fade out over 80 ms and the new ones fade in over 120 ms.
- **First paint** (intro step 4): rows reveal bottom to top over 800 ms with `ease.linear`. This is the only place the terrain "draws on".
- **While dragging a numeric value:** the coarse 24×16 grid updates at most every 100 ms. The full grid is computed 150 ms after the pointer is released. A categorical change computes the full grid immediately.

## Scroll mapping

- `beatProgress = clamp((scrollY - beatStart) / beatLength, 0, 1)`. It is recomputed on `scroll` (passive) and `resize`. Beat bounds are cached and refreshed on resize and font load.
- Visual targets are pure functions of `(beatIndex, beatProgress)`. The springs chase the targets, which gives smoothing without hijacking.
- Within a beat, sub-steps trigger at fixed progress thresholds: 0.0, 0.33, 0.66. Captions use `IntersectionObserver` with `rootMargin: "-40% 0px -40% 0px"`.

## Reduced motion (`prefers-reduced-motion: reduce`)

This is a separate mode, read once at start and observed live:

- All springs and positional tweens become `instant`. Points jump to their layout.
- The camera jumps, with no zoom animation.
- Opacity crossfades are kept but capped at 120 ms. They are not vestibular triggers and they preserve continuity.
- The number ticker is off, so values change immediately. The live dot uses the underline variant.
- The intro is replaced by three static frames (see `scroll-storyboard.md`).
- The terrain first paint is an instant reveal.
- Inference still runs live. **Reduced motion must never mean reduced model.**

## Suggested files (for the engineer, not prescriptive beyond names)

- `site/src/motion/config.ts`: the tokens in this document, exported as constants.
- `site/src/motion/spring.ts`: the damped spring.
- `site/src/motion/useReducedMotion.ts`: a hook around `matchMedia`.
- `site/src/motion/scroll.ts`: beat bounds plus progress.
