# Responsive spec (approved)

There are three distinct compositions, not one layout that shrinks. The breakpoints are content-driven:

- **≥ 1200** is desktop, with 1440 as the reference.
- **700–1199** is tablet, with 768 as the reference.
- **< 700** is mobile, with 390 as the reference.

Every width uses a minimum 16px side gutter and no horizontal page scroll. Use `100svh`, not `100vh`, so the mobile URL bar does not resize the canvas.

## Compositions per element

| Element | 1440 desktop | 768 tablet | 390 mobile |
|---|---|---|---|
| **Terrain** | full-bleed 100vw × 100svh, sticky; plot rect inset (left / right / top / bottom) 96 / 68 / 72 / 88 | full-bleed, sticky; plot rect inset (left / right / top / bottom) 64 / 24 / 64 / 120 (room for the bottom dock) | **top 58svh** sticky "window"; the lower 42svh is DOM content scrolling under it |
| **Grid resolution** | 48 × 32 (coarse 24 × 16) | 40 × 28 (coarse 20 × 14) | 32 × 24 (coarse 16 × 12) |
| **Axes** | tenure on x, charge on y | same | **same orientation** (consistency beats fit); tick labels every 24 mo and $40 |
| **Points** | r 2.5 | r 2.5 | r 2; ring r+1.5 |
| **Instrument rail (Lab controls)** | right-edge vertical rail: 20px collapsed, 320px expanded/pinned; overlays the terrain | **bottom dock**: 96px collapsed with 4 key controls (Contract, Internet, Payment, tenure) as segmented pills; swipe up to a 60svh sheet with all 19 in 4 tabs | **the explorable sentence** (from Concept B) in the lower panel: "A *female* customer, *10* months in, paying *$55.20*/mo on a *month-to-month* contract with *DSL*…"; tap an italic word to open a bottom sheet with options; "All 19 features" opens a full-screen sheet grouped in 4 sections |
| **Focal drag** | crosshair drag on the terrain | crosshair drag (44px target) | crosshair drag with 44px target; tenure and charge are also scrubbable words in the sentence |
| **Probability readout** | mono tag pinned next to the crosshair plus `num-hero` in the rail | tag plus `num-hero` in the dock's left slot | `num-hero` (48px) top-left of the terrain window, fixed; the tag near the crosshair is hidden (too small) |
| **Inference ledger** | foot of the rail, full (folds plus ms) | right end of the dock, compact (`5 folds · {ms}`); tap to expand | one line under the sentence: `live · 5 folds · {ms}` |
| **Mini threshold rail** | bottom of the plot, full width | above the dock | thin strip at the bottom edge of the terrain window |
| **Captions** | 44ch blocks over the terrain, on the side opposite the focal point | 40ch blocks over the terrain, upper area | **never over the terrain**; captions live in the scrolling lower panel, full width minus gutters |
| **Display type** | 128px | ~84px | 56px, max 3 lines |
| **Intro** | full composition (10 s) | same; camera zoom 2.2× | 200 points kept, durations scaled 0.8 (8 s), zoom 1.8×; the beeswarm rail is shown *vertically* (probability on y) for the 3.0–5.2 s step, then unfolds into the plane |

## Beats per breakpoint

| Beat | 1440 | 768 | 390 |
|---|---|---|---|
| 1 Data | captions left, points across the full plane | captions top | terrain window plus captions below |
| 2 Features | global importance list in columns 8–12 over the terrain | importance list in the bottom sheet (top 10 visible) | importance list as a horizontally scrollable chip row of the top 8 under the terrain window; tap a chip to set the lens; full list on demand |
| 3 Decision Boundary | 3 sub-steps over the sticky terrain | same | same, with captions below; "tap a dot to stand on their ground", where the tap uses the 22px nearest-neighbor |
| 4 Prediction | rail pinned expanded | dock expanded to the sheet by default (40svh) | sentence Lab plus "Call it" as two large buttons |
| 5 Explanation | ledger in columns 7–12, terrain at 30% | ledger in the full-width lower half, terrain upper half | **terrain window shrinks to 34svh**; ledger full width below; SHAP and sensitivity are **tabs**, not side by side |
| 6 Evaluation | grid plus held-out panel side by side; comparison strip below; ROC and reliability right | grid and held-out panel stacked as 2 columns; ROC and reliability side by side below | single column in order: held-out headline numbers → confusion grid (dot squares, 4px dots) → threshold rail → comparison (one metric at a time, a 4-option segmented switch) → ROC → reliability |

## Performance by breakpoint

- On **mobile**, the default grid is 32 × 24. If the first measured full-grid run exceeds 250ms, drop to 24 × 18 and say so in the ledger.
- Canvas backing store: `devicePixelRatio`, capped at **2**. The terrain canvas uses DPR **1**, because it is a smooth upscaled field and gains nothing from DPR.
- The rAF loop stops when idle: no settling springs and no active pointer.

## Orientation and edge cases

- **Landscape phone (height < 500):** the terrain window takes the left 55% and the sentence Lab sits on the right, scrollable. No intro zoom.
- **Very wide (≥ 1920):** the plot rect is capped at 1600 × 1000 and centered. Outside the plot rect, the terrain fades to `bg` over 120px. It does not extend edge cells, because that would show predictions for tenure and charge values that were never computed.
- **Text zoom to 200%:** the captions reflow in the DOM, and the canvas is unaffected. The rail becomes a scrollable panel, so controls are never clipped.
