# Concept A: TERRAIN

## Visual thesis

The model is a landscape, and the visitor walks one customer across it.

The entire viewport is a full-bleed, pixel-dense **probability terrain**. It is a real 2D slice of the 19-feature model:

- The x axis is tenure, from 1 to 72 months.
- The y axis is monthly charge, from $18.25 to $118.75 (the dataset range).
- Every cell is a live ONNX inference for a hypothetical customer who shares the selected customer's other 17 attributes. TotalCharges is derived as tenure × charge.
- The 400 real held-out customers float above the terrain as points. Each point is colored by its *own* real probability and ringed if it actually churned.

There is almost no chrome:

- A thin instrument rail on the right edge.
- A probability readout that follows the selected point.
- Editorial captions laid directly on the field.

When the visitor changes a single switch, for example Contract: Month-to-month → One year, the *whole terrain* recomputes. That is about 1,500 real model calls in the browser, and the mint retention basin floods across the plane. The decision boundary is never drawn by a designer. It is the model's own 0.10 contour, traced with `d3.contours` over the live grid.

## Palette

The five mandated colors are used as given. Supporting neutrals are derived from the background:

| Token | Hex | Role |
|---|---|---|
| bg | `#0B1110` | page and terrain floor |
| mint | `#B5FFCE` | retention side of terrain, "lowers risk" bars, focus rings |
| ivory | `#F0F3EB` | headlines, body copy, real-customer point fill |
| coral | `#FF866D` | churn side of terrain, "raises risk", the 0.10 contour glow |
| gray | `#87928B` | axes, metadata, secondary mono |
| surface-1 (added) | `#121A18` | instrument rail |
| line (added) | `#24302C` | hairlines, grid ticks |

The terrain ramp runs from mint at 22% alpha (p ≈ 0), through bg (p = 0.10, the threshold), to coral at 38% alpha (p = 1). It is diverging and *centered on the threshold, not on 0.5*.

## Typography

- **Bricolage Grotesque** (Google Fonts, OFL, variable `opsz` 12–96, `wght` 200–800) for headings and captions. Its optical-size axis lets one family set both 120px claims and 14px captions.
- **JetBrains Mono** (Google Fonts, OFL, variable `wght` 100–800) for every model-produced number, feature name and log line. It has tabular figures by default.

## Layout strategy

- **Full-bleed canvas** at 100vw × 100svh, sticky behind the whole narrative.
- Content blocks scroll *over* the field as narrow captions (max 44ch) that are anchored to the marks they describe.
- The Lab is not a panel. Its controls are a **20px-wide vertical rail** that expands to 320px on hover or focus. The probability is a mono tag pinned to the selected point.
- The information density on screen is low. The density lives *in the field*.

## Opening storyboard (10.0 s)

1. **0.0–1.2 s.** Black. A 1px gray baseline draws left to right. The mono caption types out: `400 held-out customers · model never saw them`.
2. **1.2–3.0 s.** 200 points appear at seeded positions. They are a deterministic subset of the 400 (`d3.shuffler(d3.randomLcg(846))`), always including #276. They drift as ivory dust on seeded sinusoids.
3. **3.0–5.2 s.** The points slide onto a horizontal **logit-scaled probability axis** at their *real* calibrated probability, stacked as a beeswarm.
   - About two-thirds settle right of 0.10 and turn coral. The rest settle left and turn mint.
   - A coral vertical line rises at p = 0.10 with the label `threshold 0.10 · FN $500 / FP $50`. This is the decision boundary, and it is exact for every point.
4. **5.2–7.2 s.** The axis tilts and unfolds into the 2D plane.
   - Points glide to their real (tenure, monthly charge) coordinates.
   - The terrain paints in beneath them, row by row, as the first real ONNX grid resolves. If ONNX is not warm yet, the unfold completes without terrain, and the terrain paints in whenever the first real grid arrives. Nothing is faked in the meantime.
   - The vertical threshold line bends into the 0.10 contour of #276's slice.
5. **7.2–9.0 s.** The camera eases toward #276. The scale goes from 1× to 2.6× around her point, and the other points defocus to 35% opacity.
6. **9.0–10.0 s.** Her point blooms into a crosshair. The mono tag `#276 · p 0.217 · churn side` appears, the rail slides in, and the caption reads "Drag her. The model answers every frame."

A **Skip** button (top-right, focusable first) is visible from frame 0. With `prefers-reduced-motion`, the intro becomes three static crossfades: axis, terrain, focused.

## Motion grammar

- **Physical, damped, never bouncy.** Positions use critically damped springs: ζ = 1, 180–260 ms settle.
- **The field never animates color for decoration.** It changes only when the model output changes, crossfading 160 ms between grids.
- The scroll story drives *camera* (pan/zoom) and *layer opacity*. It never drives the data.

## Primary interaction: Prediction Laboratory

- **Direct manipulation on the terrain.** Dragging #276 changes tenure (x) and monthly charge (y). The probability tag updates live, and crossing the 0.10 contour flips the tag from coral to mint with a hairline pulse.
- **Categorical switches on the rail** (Contract, Internet, Payment, and the other 13 categoricals) recompute the *whole terrain*. This is the "main event": the landscape rearranges itself.
- An **inference ledger** in mono, at the rail foot, reads, e.g., `1,536 rows · 5 folds · {measured ms} · wasm` (ms is the real `performance.now()` delta).

## Technical approach

- **Canvas 2D**, with three stacked canvases: terrain (an ImageData grid upscaled with bilinear smoothing), contours (`d3.contours` paths), and points.
- WebGL is unnecessary. The domain is 2D, there are 400 points, and the field is ≤ 48×32 cells upscaled. Canvas 2D draws this in under 2 ms.
- SVG is used only for axes and labels, which need crisp text and accessibility.
- ONNX runs in a **Web Worker** with a batched path.

## Performance risk

- **Inference throughput during drag.** Each categorical edit is about 1,536 rows × 5 folds. Wasm may land at 80–200 ms per grid on mid-range phones, which would make dragging stutter.
- **Mitigation:**
  - Only the focal point's single-row inference runs per drag frame, coalesced to rAF.
  - The terrain recomputes on release, or at a coarse 24×16 grid while a control is held.
- Separately, the onnxruntime-web wasm binary is about 14 MB. The intro must cover that load.
