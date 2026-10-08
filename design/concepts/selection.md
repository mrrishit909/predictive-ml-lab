# Concept selection

## Criteria

1. **Hard rejection.** The concept must not be "a generic form surrounded by four KPI cards". The decision-space visualization must *be* the site's visual identity.
2. **ONNX as the main event.** Live in-browser inference must be the thing the visitor feels, not a hidden detail behind a submit button.
3. **Honesty.** Every boundary, number and explanation must be exactly what it claims to be: real model output, real SHAP, or real metrics with stated n and threshold.
4. **Mandate fit.** The concept must cover the intro spec (200 seeded points → two class regions → visible boundary → zoom to one customer → expand into workspace), all 19 controllable features, and the six-beat narrative.
5. **Buildability and performance.** The concept must be shippable on the installed stack (React, d3, onnxruntime-web) on a mid-range phone.

The criteria are scored from 1 to 5. Criteria 1 and 2 are weighted ×2.

| Criterion | A · Terrain | B · Margin Notes | C · Telemetry |
|---|---|---|---|
| 1. Not form + KPI cards; viz is the identity (×2) | **5**: the field *is* the page, there are no cards and the controls live on the terrain | 3: the rail is a strong spine, but the identity is typographic; Evaluation risks turning into a table page | **2**: 19 toggles + gauges + readout tiles around a center viz is the form + KPI-cards pattern in costume |
| 2. ONNX inference is the main event (×2) | **5**: one switch recomputes ~1,500 real inferences and the whole landscape visibly rearranges | 2: one row per edit; the dot slides a few px on a rail, which reads like a lookup | 4: the fold gauges and inference log *expose* the engine brilliantly, but the result is a moving star in an abstract projection |
| 3. Honesty | **5**: every pixel is an exact model output for a nameable hypothetical customer; the 0.10 contour is the model's own | **5**: a 1D threshold rail is exactly true for every customer | 2: the PCA layout and density "filament" are approximations that must be labeled as such, at the visual center of the site |
| 4. Mandate fit | **5**: the intro maps 1:1 (axis → boundary → unfold → zoom → bloom into workspace) | 3: the stepper fights the mandated continuous scroll narrative; the "zoom into a customer" is weak | 4: covers everything, but the boundary is not a model boundary |
| 5. Buildability and performance | 4: needs a worker plus a batched inference path (feasible: the ONNX inputs have a dynamic batch dim; 1,536 rows ≈ 26 ms in Node) | **5**: the simplest to build | 2: WebGL plus about 8 animated panels plus a worker |
| **Weighted total (/35)** | **34** | 23 | 20 |

## Winner: Concept A · TERRAIN

A is the only concept where **the decision space is the site**. The visitor never looks at "a chart of the model". They stand inside the model's output surface and move a real customer across it.

A is also the only concept where inference is *visibly expensive and visibly real*. Flipping Contract to "One year" reshapes the entire plane, which no precomputed lookup could plausibly fake for an arbitrary combination of 17 other attributes.

It stays honest because of three choices:

- It uses two real axes, not a projection.
- It holds the other 17 features at a named customer's actual values.
- It derives TotalCharges explicitly.

Measured from the real model, A has a ready-made hero beat:

- Customer **#276** (p 0.217, actually churned) sits on the churn side.
- Dragging her from 10 to **24 months tenure** gives p **0.092**, and she crosses the 0.10 contour.
- Switching her to a **One-year contract** gives p **0.079**.
- Switching her to **Fiber optic** gives p **0.359**.

### Weaknesses of A we must design around

- **174 of 400 customers have slices with no 0.10 boundary.** Every cell in those slices is flagged as churn. The terrain therefore shows continuous probability bands plus iso-lines at 0.25 and 0.50, so there is always structure. When the 0.10 contour is absent, it says so in plain words: "For this profile, the model flags every tenure and price on this plane." That sentence is itself an insight.
- **Points vs. field disagreement.** Each point is colored by its *own* real probability. The field shows the model's view *for the selected customer's profile*. A coral point can sit in a mint basin. The Decision Space beat explains this on purpose and offers "re-slice on this customer" when a point is clicked.
- **Low on-screen numeric density.** The Evaluation beat needs denser typography than A's minimal chrome provides. We take that from B (see below).

## Ideas folded in from the losing concepts

1. **From B: the logit-scaled threshold rail and the explorable sentence.**
   - The rail is the one view where 0.10 is an exact boundary for *all* 400 customers at once, so it becomes:
     - stage 1 of the intro (points settle on it before it unfolds into the terrain);
     - a persistent 1D "mini-rail" at the bottom of the Lab that shows where the edited customer sits among all 400;
     - the backbone of the Evaluation beat, where the threshold can be dragged and its effect on the sample confusion counts is shown.
   - B's **explorable sentence** becomes the Lab's *screen-reader summary* and the **390px mobile Lab**, where a 320px rail does not fit (see `approved/responsive-spec.md`).
2. **From C: the live inference ledger with per-fold outputs.**
   - C's best idea is exposing the five CV-fold calibrated outputs and the measured latency.
   - A adopts it as a compact mono ledger at the rail foot: five tick marks on a tiny 0–1 strip (one per fold), their mean, and `rows · folds · ms · backend`.
   - This makes the ensemble *legible* and proves to a technical visitor that inference is happening, without C's dashboard sprawl.

Rejected from C: the PCA constellation and the WebGL bloom. They are less honest and slower, and they contribute nothing that the terrain does not already say.
