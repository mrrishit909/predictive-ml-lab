# Concept C: TELEMETRY

## Visual thesis

The model is a live instrument, and you are on the console.

PREDICTIVE is a **dense, coordinated instrument panel**, the opposite of A's emptiness:

- A central **constellation**: the 400 real customers laid out by a deterministic PCA projection of their one-hot and standardized features (computed in-browser, no randomness). Each point is a soft light source, with luminance mapped to churn probability.
- Six to eight linked readouts surround it like a flight deck:
  - an oscilloscope trace of the probability over the visitor's edit history;
  - five tiny gauges, one per CV fold, showing each fold's calibrated output before averaging;
  - a scrolling **inference log**;
  - a feature matrix with 19 rows of mini-toggles.
- Hovering anything cross-highlights everything.

It is the most abstract concept: the point cloud reads as a galaxy, not a chart. It is also the most *technical*: it exposes the ensemble's five folds and the per-call latency, which no other concept does.

## Palette

The mandated five are used, with gray promoted to the dominant structural color and mint used as phosphor.

| Token | Hex | Role |
|---|---|---|
| bg | `#0B1110` | console floor |
| gray | `#87928B` | panel frames, labels, gauges (dominant) |
| mint | `#B5FFCE` | phosphor traces, retained points, "live" indicators |
| coral | `#FF866D` | churn-side glow, warnings, threshold crossings |
| ivory | `#F0F3EB` | headline numerals, selected state |
| bezel (added) | `#151E1B` | panel backgrounds |
| grid (added) | `#1E2925` | 8px dot grid behind panels |

## Typography

- **Space Grotesk** (Google Fonts, OFL, 300–700) for panel titles and the large section heads. Its squared terminals suit the console voice.
- **Martian Mono** (Google Fonts, OFL, variable `wght` 100–800, width axis) for everything numeric. A condensed width is used in dense tables and a wide width for the hero probability.

## Layout strategy

- A **fixed 12×8 tiled dashboard** that fills the viewport. The constellation takes 6×6 tiles in the center, and the readouts tile around it.
- Scroll does not move the page. It **re-patches the console**: each of the six beats swaps which readouts are mounted, like changing instrument pages.
- Information density is very high, with about 20 numbers visible at all times.

## Opening storyboard (11.0 s)

1. **0–2.0 s.** The panels power on in sequence (frame strokes draw, labels flicker in) with a mono boot log. The boot log is real: `fetch fold_0.onnx 264 KB ✓`, and so on, tied to the actual model load.
2. **2.0–4.0 s.** 200 points (seeded `d3.shuffler(d3.randomLcg(846))` subset) ignite at the center as a dense ball.
3. **4.0–6.5 s.** The ball expands into the PCA constellation, with each point at its projected coordinate. The colors resolve into coral and mint by real probability against 0.10.
4. **6.5–8.0 s.** Two density contours (`d3.contourDensity`, one per predicted class) fade in as soft halos. A glowing filament is drawn where they meet. The filament is labeled `approximate separation · projection`, because it is **not** the model's boundary.
5. **8.0–9.5 s.** The constellation rotates its 2D frame so that #276 sits at the reticle. The view zooms 3×.
6. **9.5–11.0 s.** The fold gauges spin up to #276's five real fold outputs, the averaged p 0.217 locks in large Martian Mono, and the console is live.

**Skip** is a hardware-style key, `ESC · skip`. With reduced motion, the panels appear powered and static.

## Motion grammar

- **Electronic.** Movements are instant-on with tiny overshoot flickers.
- Values tick with a 60–90 ms digit roll.
- Traces draw at constant velocity (linear), like a scope.
- There are no long eases. Everything resolves in under 300 ms, with persistent ambient motion in the log and scope.

## Primary interaction: Prediction Laboratory

- The 19-row toggle matrix sits on the left: segmented buttons and steppers.
- Every change fires an inference, which logs a line (format: `#0047 · 1 row · 5 folds · {measured} ms → {p}`; latency is measured, never typed in). The five gauges swing, the scope trace extends, and #276's star moves.
- Because the constellation is a projection, editing features **moves her point in projection space**, recomputed via the fixed PCA basis.

## Technical approach

- **Light WebGL** (raw WebGL2, no three.js) for the constellation's additive glow on 400 sprites. Canvas 2D for the scope and gauges. SVG for labels.
- WebGL is justified only by the bloom aesthetic, not by data volume.

## Performance risk

- **Too many simultaneous animated panels.** About 8 rAF-driven readouts, a WebGL context and a worker-based ONNX could exceed the frame budget on low-end laptops and drain mobile batteries.
- There is a secondary *honesty* risk: the PCA layout and its density filament are an approximation of the model, not the model.
