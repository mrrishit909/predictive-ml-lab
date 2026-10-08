# Scroll storyboard (approved)

## Structure

**Intro (10 s, time-based) → Hero workspace → six scroll beats.** The beats follow the mandated narrative:

**Data → Features → Decision Boundary → Prediction → Explanation → Evaluation**

| Beat | Mandated area | Approx. scroll length (desktop) | Canvas |
|---|---|---|---|
| Intro → Hero | – | 1 viewport (the hero *is* the first screen after the intro) | sticky |
| 1 Data | – | 150vh | sticky |
| 2 Features | – | 200vh (3 sub-steps) | sticky |
| 3 Decision Boundary | **Decision Space** | 250vh (3 sub-steps) | sticky |
| 4 Prediction | **Prediction Laboratory** | 150vh, then the Lab stays interactive while pinned | sticky |
| 5 Explanation | **Explainability** | 200vh (2 sub-steps) | sticky |
| 6 Evaluation | **Model Evaluation** | natural height (≈ 2 viewports) | un-sticks; inline canvas |

**Shared rules for every beat:**

- The terrain, points and Lab remain interactive in every beat. Scroll sets the *default* state, and the visitor can always poke the model.
- If the visitor has edited the customer, the beats keep the edited customer. The captions switch to the conditional copy given below.

**Data loading:**

- The fixture JSONs (≈ 400 rows each) are fetched at page load.
- `loadModel()` starts **at intro frame 0** in a Web Worker. The intro (10 s) covers the ~14 MB wasm download plus about 1.3 MB of models on most connections.
- The ledger shows the real state: `model · loading 37%` → `warming` → `ready · wasm`.

---

## Intro (time-based, 10.0 s; skippable)

The ~200 points are a deterministic subset of the real 400: `d3.shuffler(d3.randomLcg(846))(ids)`, taking the first 199. Note that plain `d3.shuffle` uses `Math.random` and must not be used. `d3.shuffler` is verified present in the installed d3 7.9 and deterministic across runs. and **always** adding #276. Seed 846 is a nod to the AUC. It is fixed.

| t (s) | Start state | End state | What changes |
|---|---|---|---|
| 0.0–1.2 | black `bg` | baseline drawn | A 1px gray line draws L→R (`ease.linear`). Mono caption: `400 customers the model never saw · 200 shown`. **Skip** (top right, first in tab order, `Esc` also works) is visible from frame 0. |
| 1.2–3.0 | empty | 200 ivory points drifting | Points fade in at seeded positions. Each point drifts on a **seeded sinusoid**: `dx = 12·sin(t·ω₁ + φ₁)`, `dy = 12·sin(t·ω₂ + φ₂)`, with ω in 0.4–0.9 rad/s. The phases and frequencies are drawn from the same single `d3.randomLcg(846)` stream, in id order. d3 has no noise function, and this needs no new dependency. The drift ends at 3.0 and does not loop. |
| 3.0–5.2 | drifting dust | beeswarm on the **logit threshold rail** | Each point springs (`spring.point`, rank-staggered) to x = logit(its real calibrated p), stacking in a beeswarm. The precomputed swarm positions come from `d3.forceSimulation(nodes).randomSource(d3.randomLcg(846)).stop()` ticked synchronously a fixed 120 times at load, so the result is deterministic. Nodes start at x = target and y = 0, so no random initial placement is used. Points recolor coral or mint as they cross x(0.10). At 4.4 s a coral rule rises at 0.10, with the mono label `threshold 0.10 · cost-optimal (FN $500 · FP $50)`. Count captions tick up: `churn side 134 · retain side 66` (the *actual* counts for the subset, computed at runtime). |
| 5.2–7.2 | rail | 2D plane | The axis "unfolds" with `ease.inOut`. Points travel from the rail to (tenure ± deterministic jitter, MonthlyCharges). Axes fade in. **If ONNX is ready**, #276's terrain reveals bottom to top over 800 ms and the 0.10 rule visually hands off into the 0.10 contour (the rule fades as the contour draws on). **If ONNX is not ready**, the plane shows points only, with the caption `model warming…`. The terrain appears whenever it is ready, during the intro or later. Nothing is faked. |
| 7.2–9.0 | whole plane | camera on #276 | `spring.camera` toward scale 2.6 centered on #276. Other points fade to 35%. |
| 9.0–10.0 | zoomed | **Hero workspace** | #276 blooms (r 2.5 → 5 plus crosshair). The tag appears: `#276 · p 0.217 · churn side · actually churned`. The rail slides in collapsed (`medium`). The display claim sets: "Drag her. The model answers every frame." The camera eases back to 1.4× so the context points remain visible as a subtle interactive field. |

> *The subset counts above (134/66) are illustrative. The engineer computes the real counts from the seeded subset and renders them. Do not hard-code them.*

**Skip:** jump to the end-state of 10.0 s. If ONNX is not warm, the terrain fills in when ready.

**Reduced motion:** three static frames crossfade at 120 ms. Each holds for 1.2 s and can be advanced with any key or click. The frames are:

1. the threshold rail with the 200 colored points;
2. the 2D plane with the terrain (or points only, if not yet ready);
3. the Hero workspace.

**Return visits:** session storage `predictive.introSeen` makes the intro auto-skip. A "Replay intro" link sits in the footer. Storage access is wrapped in try/catch.

---

## Beat 1 · Data: "Four hundred real customers."

- **Trigger:** beat 1 enters (`beatProgress` > 0).
- **Start state:** Hero workspace (terrain visible, #276 focused).
- **End state:**
  - The terrain fades to 0.
  - All **400** points are shown, in **ivory/70**, with no model coloring.
  - The ivory rings mark the 120 who actually churned.
  - The camera is at 1×.
- **What changes:**
  - The terrain alpha follows 1 → 0 over the first 30% of progress.
  - The 200 non-intro points fade in.
  - The class colors desaturate to ivory.
  - Captions (Bricolage `display` plus mono evidence):
    - "Four hundred customers from the held-out test set."
    - `n=400 of 1,409 · 120 churned (30.0%) · full test set 26.5%`
    - "Each point is a real person. Rings mark the ones who actually left."
  - **Hovering a point** shows a tooltip with the record's mono key facts: id, tenure, charge, contract, internet, and `actual: churned / stayed`.
- **Reduced motion:** instant swap. The captions are the same.

## Beat 2 · Features: "Nineteen things we know about them."

There are three sub-steps, at progress 0 / 0.33 / 0.66. Each one applies a **feature lens**: it recolors the points by one raw feature value with a temporary categorical palette (ivory, ivory/35, gray). Shape is added (filled, hollow, cross) when there are 3 values. It never uses mint or coral, because those are reserved for model output.

1. **Contract:** points recolor as Month-to-month (ivory), One year (ivory/35), Two year (gray). Lens colors never use mint or coral, which are reserved for model output. The legend counts come from the data: 224 / 75 / 101.
2. **Tenure:** the color is unchanged. A vertical scan line sweeps across x and a mono histogram rises along the x axis.
3. **InternetService:** DSL, Fiber optic, No.

- **Side panel (columns 8–12):** the **global importance list** from `feature.explanations.json.global`: 20 rows, `mean |SHAP|`. It is labeled `mean |SHAP| · log-odds · base model`. The row for the active lens's feature is highlighted. The human label is shown next to the raw encoded name (e.g. "Month-to-month contract" next to `cat__Contract_Month-to-month`).
- **Trigger:** sub-step thresholds.
- **Start state:** ivory population (end of beat 1).
- **End state:** InternetService lens.
- **Interaction:** clicking any of the 19 feature names in the list sets the lens.
- **Reduced motion:** instant recolor. The scan line becomes a static histogram.

## Beat 3 · Decision Boundary (Decision Space): "Where the model draws the line."

- **Sub-step 3a (0–0.33).** The points spring from the plane back onto the **threshold rail** (logit x of the real p) and color mint or coral. The coral 0.10 rule is labeled.
  - Captions: "One number decides: the calibrated probability. At 0.10 or above, the model flags a customer." `268 of 400 flagged · threshold chosen to minimize cost: a missed churner costs $500, a false alarm $50.`
- **Sub-step 3b (0.33–0.66).** The rail unfolds into the plane (the reverse of beat 1's collapse, the same motion as intro step 4). #276's **terrain** fades in with all iso-lines, and the 0.10 contour draws on (`ease.linear`, 600 ms).
  - Caption (mandatory meaning): "The background is the model's answer for every customer like #276, differing only in tenure and monthly charge. 1,536 live predictions, computed in your browser."
  - Under the caption, the ledger shows the real measured run.
- **Sub-step 3c (0.66–1).** **Disagreement, explained.** Points whose own class differs from the terrain under them get a 1px gray halo.
  - Caption: "Some dots disagree with the ground beneath them. Each dot has its own 17 other attributes. The ground only shows #276's. **Click any customer to stand on their ground.**"
  - **Click any point** to make it the focal customer. The terrain re-slices on that customer's profile (live), and the camera pans (`long`).
  - If the new slice has no 0.10 contour, the status says: "No 0.10 boundary in this slice: the model flags this profile at every tenure and price shown."
- **Trigger:** sub-step thresholds. A click is an immediate override.
- **Start state:** InternetService lens on the plane.
- **End state:** the colored plane, #276's terrain, disagreement halos.
- **Reduced motion:** instant layout changes. The contour appears without draw-on.

## Beat 4 · Prediction (Prediction Laboratory): "Your turn."

- **Trigger:** beat 4 enters. The camera springs to #276 (or the current focal) at 1.8×.
- **Start state:** beat 3 end.
- **End state:**
  - The rail is **expanded** (320px) with all 19 controls.
  - The terrain is live, and the inference ledger is visible.
  - The mini threshold rail is pinned at the bottom.
- **"Call it" moment** (predict-first, after Distill):
  - On first entry, before showing #276's outcome, two buttons ask: "Did #276 leave? [Stayed] [Left]".
  - After a choice (or a Skip), reveal `actual: churned` and `model: p 0.217 → flagged`. The reveal shows whether the visitor and the model agreed.
  - It is shown once per session.
- **Guided first edit:** a ghost hint arrow invites "Drag her right." Dragging #276 to about 24 months crosses the 0.10 contour (p 0.092, measured), and the tag flips to mint. The hint disappears after the first drag or 6 s.
- **Captions:**
  - "Every change re-runs the shipped model: five gradient-boosted folds, isotonic-calibrated, averaged. Nothing here is a lookup table."
  - The parity line, in micro mono: `matches scikit-learn within 1e-4 on 398 / 400 held-out rows · max deviation 0.012`.
- **Reduced motion:** no camera zoom (stays at 1×). The hint is static text.

## Beat 5 · Explanation (Explainability): "Why the model thinks so."

There are two sub-steps. The visual distinction between **genuine SHAP** and **live sensitivity** is the core of this beat.

- **5a · SHAP (genuine, precomputed).** The precondition is that the focal customer is an **unedited fixture row**.
  - The contribution ledger shows that row's 8 stored `top_factors`, sorted by |value|.
  - The bars are **solid** fills, coral for positive and mint for negative, growing out from a central zero line, staggered 40 ms by rank (`ease.out`, `medium`).
  - The header carries the mandatory label: `SHAP · log-odds · HGB base model · not the calibrated probability · top 8 of 46 encoded features`.
  - A gray footer row reads: `remaining 38 encoded features · not stored in fixture`. There is no base value and no sum to f(x), because the fixture contains neither. The ledger must not visually "land" on the probability.
  - Hovering a row highlights the matching rail control and, for tenure or charge, the matching axis.
- **5b · Live sensitivity (exact model output, not SHAP).**
  - It is shown side by side with 5a when the customer is unedited, and **instead of** 5a when the customer is edited.
  - For each of the 19 raw features, compute p with that feature switched to each alternative value (numerics: ±12 months tenure, ±$20 charge, clamped). Bars show the largest Δp in each direction. This is a batch of about 31 rows through ONNX: 27 categorical alternatives plus 4 numeric nudges. TotalCharges follows the linked rule.
  - Bars are **outlined with 45° hatching**, never solid, and the unit is **Δ probability** (`−0.138`), not log-odds.
  - The header reads: `live sensitivity · exact Δ calibrated probability per single switch · not SHAP`.
  - Clicking a bar applies that switch, so the visitor can see it happen on the terrain.
- **Edited state copy:** "SHAP was precomputed for the original #276. You've changed her, so here is what the live model says instead." A link restores the original.
- **Trigger:** sub-step thresholds.
- **Start state:** beat 4 end.
- **End state:** 5b visible.
- **Reduced motion:** bars render at final length. The hatch is static, as always.

## Beat 6 · Evaluation (Model Evaluation): "How often is it right?"

- **Trigger:** beat 6 top reaches 60% of the viewport.
- **Hand-off:**
  - The sticky canvas fades its terrain out.
  - The 400 points spring (`long`, rank-staggered by destination cell) into a 2×2 **confusion grid**, rendered on an inline canvas.
  - The sticky container releases at the end of the flight.
  - The grid is computed **live** from the fixtures at the current threshold. At 0.10 it shows TP 114 · FP 154 · FN 6 · TN 126, labeled `sample n=400 · @0.10`.
- **Held-out panel:** values come *only* from `model.metrics.json` and are titled `Held-out test set · n=1,409`.
  - Calibrated (shipped) model: ROC-AUC **0.845**, PR-AUC **0.660**, Brier **0.136**.
  - Confusion at **@0.50**: TN 925 · FP 110 · FN 173 · TP 201, with precision 0.646, recall 0.537 and F1 0.587.
  - **@0.10** from `cost_threshold_metrics`: TN 480 · FP 555 · FN 16 · TP 358, with recall 0.957 and precision 0.392.
  - A one-line explanation: "At 0.10 it catches 96% of churners and pays for it in false alarms. That trade was chosen by cost."
- **Model comparison:** a dot plot of 4 models × ROC-AUC / PR-AUC / Brier / F1 (@0.50, as the fixture is).
  - Dummy 0.500 / 0.265 / 0.265 / 0.000.
  - LR 0.842 / 0.633 / 0.169 / 0.614.
  - HGB 0.846 / 0.658 / 0.136 / 0.584.
  - Calibrated 0.845 / 0.660 / 0.136 / 0.587.
  - The CV ROC-AUC mean ± std is shown as a whisker where the fixture has it: dummy, LR and HGB (not the calibrated model).
  - The engineer renders values from the file at runtime. The numbers here document what is expected.
- **Sample curves (DERIVED, gray):**
  - ROC from the 400 sample (`AUC 0.854 · sample n=400 · calibrated only`).
  - Reliability diagram with quantile bins and per-bin n.
- **Threshold rail:**
  - Draggable from 0.01 to 0.90 on a logit scale, with marks at 0.10 (shipped) and 0.50 (default).
  - Dragging re-sorts the dots between cells (springs) and updates the sample counts (mono ticker).
  - The held-out panel stays fixed. It only has @0.10 and @0.50, and it highlights whichever one the rail is nearest.
- **Reduced motion:** the dots appear directly in their cells. Threshold drags update instantly.

---

## Accessible fallback (all beats)

- Every beat has a visually hidden `<section>` with a heading and its text. The text is the same as the captions plus a textual summary of the visual state, for example "Terrain for customer 276: churn probability is above 0.10 for 62% of the plane; the boundary runs roughly along 24 months tenure."
- The canvas is `aria-hidden="true"`. Points and interactions have DOM equivalents (see `interaction-map.md`).
- The narrative works with JS-rendered text only, with no canvas at all. If WebGL is ever added, it is optional, and Canvas 2D is the primary path.
