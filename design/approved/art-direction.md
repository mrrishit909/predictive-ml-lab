# Art direction: PREDICTIVE · TERRAIN (approved)

The approved concept is Concept A, TERRAIN. It also carries two ideas from the losing concepts:

- From B: the threshold rail and the explorable sentence.
- From C: the per-fold inference ledger.

See `../concepts/selection.md`.

## One sentence

**You are standing on the model's output surface, and every time you touch it, the browser runs the real model again.**

## The identity

1. **The terrain.** This is a full-bleed probability field, and it is the logo, the hero and the main visualization all at once.
   - It is a real 2D slice of the 19-feature model: tenure (x) × monthly charge (y). The other 17 features are held at the *selected* customer's values, and TotalCharges is derived as tenure × charge.
   - Every cell is a live ONNX inference.
   - The 0.10 contour (the shipped cost-optimal threshold) is the decision boundary, traced from the model's output. Nobody draws it.
2. **The population.** The 400 real held-out customers are points that persist through every beat. They are never replaced by a different chart. They arrange as a raw scatter (Data), recolor by feature (Features), settle on the threshold rail and unfold into the terrain (Boundary), defocus around one customer (Prediction), and finally sort physically into a confusion matrix (Evaluation).
3. **The focal customer.** The default is **#276**: female, 10 months tenure, $55.20/mo, Month-to-month, DSL, card autopay. She actually churned, and the real model gives her p = 0.217. She is the protagonist. The visitor can adopt any other customer by clicking them.

## Voice

- Claims are set in large editorial grotesk.
- Evidence is set in monospace.
- Each sentence on screen sits next to the mark it describes.
- Copy is short, plain and declarative, for example "The model has never seen these 400 people."
- There are no marketing adjectives and no "AI-powered".

## Provenance is visible

Every number on screen belongs to exactly one of these classes. Its typographic treatment shows which class it is (see `typography.md`).

| Class | Source | Treatment |
|---|---|---|
| **LIVE** | computed now by ONNX in this browser | mono, ivory, with a 4px mint "live" dot that pulses once per inference |
| **FIXTURE** | read from `/data/*.json` (predictions, SHAP, metrics) | mono, ivory, no dot |
| **DERIVED** | computed in-browser from fixtures (sample ROC, reliability bins, threshold sweeps) | mono, gray, with the suffix `· sample n=400` |
| **APPROXIMATE** | anything not exact | **not allowed** in the primary views; if it ever appears it must be hatched and labeled |

Mandatory honesty labels (exact copy can be tuned, but the meaning cannot change):

- **Terrain caption:** "Model output for customers like #276 who differ only in tenure and monthly charge. TotalCharges = tenure × charge."
- **SHAP panel:** "SHAP values · log-odds of the gradient-boosted base model · not the calibrated probability above · top 8 of 46 encoded features stored." The 46 is 3 numeric features plus 43 one-hot columns, derived from `metadata.json` `category_values`. Compute it at runtime instead of hard-coding it.
- **Sensitivity panel:** "Live sensitivity · exact change in calibrated probability when one feature is switched · not SHAP."
- **Metrics:** Every confusion matrix states its threshold (`@0.50` or `@0.10`) and its n (`held-out n=1,409` or `sample n=400`).
- **Parity claim:** "Matches scikit-learn within 1e-4 on 398 of 400 held-out rows (max deviation 0.012)." This is measured, not "byte-identical". If the engineer fixes the two outliers, update the copy.
- **AUC:** 0.846 belongs to the *uncalibrated* tuned HGB. The **shipped** calibrated ensemble is **0.845**. Never attach 0.846 to the Lab's model.

## What this site must never look like

- A form on the left with a gauge on the right and four KPI cards on top. This is the hard rejection condition.
- Glassmorphism cards, neon gradients, or particle effects that encode nothing.
- A decision boundary drawn as a decorative curve.
- An "AI brain" illustration.
