# Composition (approved)

## Layer stack

The z order runs bottom to top:

| z | Layer | Tech | Owner |
|---|---|---|---|
| 0 | **Terrain**: probability grid, bilinear-upscaled | `<canvas>` 2D, `ImageData` at grid resolution, drawn with `imageSmoothingEnabled = true` | `FieldLayer` |
| 1 | **Contours**: iso-lines at 0.05 / 0.10 / 0.25 / 0.50 | same canvas pass or a second canvas; paths from `d3.contours()` | `FieldLayer` |
| 2 | **Points**: 400 customers plus the focal crosshair | `<canvas>` 2D, separate for hit-testing via `d3.quadtree` | `PointSystem` |
| 3 | **Axes and labels** | SVG overlay (crisp text, accessible) | React |
| 4 | **Captions**: narrative copy anchored to marks | DOM | React plus scroll controller |
| 5 | **Instrument rail**: Lab controls, ledger, mini threshold rail | DOM | React |
| 6 | **Intro overlay, skip control, tooltips** | DOM | React |

- The canvas stack is a single `position: sticky; top: 0; height: 100svh` container that spans beats 1–5.
- The container itself is **never transformed**. Only its contents change, following the pin rule from the GSAP docs.
- Beat 6 (Evaluation) un-sticks. The points carry over into an inline canvas through a hand-off (see `scroll-storyboard.md`).

## Plot geometry (desktop 1440 × 900)

- **Plot rect.** The left edge is 96px (y-axis labels). The right edge is 20px (the collapsed rail width) plus 48px. The top is 72px and the bottom is 88px (x-axis plus the mini-rail).
- **x:** tenure, linear, 0–72 months (dataset range). Ticks at 0, 12, 24, 36, 48, 60, 72 are labeled in `micro` mono as `12 mo`.
- **y:** MonthlyCharges, linear, **$18.25–$118.75**. This is the full Telco dataset range, measured from `data/raw/Telco-Customer-Churn.csv`. Ticks at $20, $40, $60, $80, $100.
- **Grid.**
  - Default: 48 × 32 cells.
  - While dragging or holding a control: a coarse 24 × 16 grid.
  - Mobile: 32 × 24.
  - Cell centers use **integer tenure**, because the training data has integer tenure.
  - TotalCharges = tenure × charge, rounded to 2 decimals.
- **Point jitter.** The data contains many duplicate integer tenures. Apply a **deterministic** jitter of ±0.35 tenure-units on x, from **one** generator, `const rng = d3.randomLcg(846)`, drawn once per customer **in ascending id order** at load time, then cached. Do not create a fresh `d3.randomLcg(id)` per customer: consecutive seeds give nearly identical first draws (I measured 0.2361, 0.2365, 0.2368… for ids 0, 1, 2), which is not jitter. Never use `Math.random()`.

## Grid and spacing

- The base unit is **8px**. The spacing scale is 4, 8, 12, 16, 24, 32, 48, 72, 120.
- The DOM content grid is 12 columns, with a 24px gutter and a 96px desktop margin. Captions over the terrain occupy columns 1–5 or 8–12. They always sit on the side **opposite** the focal point, so they never cover the protagonist. This is recomputed on each beat.
- There are no cards. Panels are flat `--surface-1` regions with **no border radius above 4px** and no drop shadows. Separation comes from a 1px `--line`.

## Key compositions

### Hero workspace (end of intro, top of page)

- The terrain is full-bleed.
- #276's crosshair sits on the left third: at tenure 10 she is near the left edge, so the camera pans to place her around x = 33%.
- The `display` claim sits in the upper right: "Drag her. The model answers every frame."
- The rail is collapsed on the right edge, showing only 19 tiny state ticks.
- The **mini threshold rail** runs along the bottom: 400 tiny ticks on a logit axis, the coral 0.10 rule, and #276's tick highlighted.

### Explanation (beat 5)

- The terrain dims to 30%.
- A **contribution ledger** takes columns 7–12.
  - It shows 8 rows of horizontal bars from a central zero axis: coral to the right (raises risk), mint to the left (lowers risk).
  - Each row has a mono feature name, a human label, and a signed value.
  - A ninth gray row reads "remaining encoded features · not stored".
- The terrain still shows #276. Hovering a ledger row that refers to tenure or charge highlights the corresponding axis.

### Evaluation (beat 6)

- The 400 points leave the terrain and fly into a **2 × 2 confusion grid**, with each cell a packed square of dots. This is the *sample at 0.10*: TP 114 / FP 154 / FN 6 / TN 126, computed live from the fixtures.
- Beside the grid, in `num-lg` mono, the **held-out** figures from `model.metrics.json` appear. They are clearly titled "Held-out test set · n = 1,409".
- Below the grid, a **model comparison strip** shows 4 rows (dummy, logistic regression, HGB tuned, HGB calibrated) × 4 metric columns (ROC-AUC, PR-AUC, Brier, F1 @0.50) as dot plots on shared axes. The shipped model's row is ivory and the others are gray.
- Two small charts sit right of the strip:
  - an **ROC curve** computed from the sample, labeled `sample n=400 · calibrated model only · AUC 0.854`;
  - a **reliability diagram** computed from the sample, using **quantile bins** (8 bins of about 50 rows each; isotonic plateaus create ties, so keep tied rows in the same bin and print each bin's n). Equal-width 0.1 bins would leave 8, 16 and 4 rows in the top three bins, which is too few to read.
- The draggable **threshold rail** spans the full width under everything. Dragging it re-sorts the dots between cells in real time (sample only). The 0.10 and 0.50 positions are marked, together with the cost-optimal held-out numbers from `cost_threshold_metrics`.

## Negative space

- At least 40% of the viewport is pure terrain at every scroll position in beats 1–4.
- If a composition needs more than 60% DOM coverage, it belongs in beat 6, which is un-stuck.
