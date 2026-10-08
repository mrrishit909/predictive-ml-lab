# PREDICTIVE: Visual references

Research date: 2026-10-08. Every URL below came from a real search result. Each entry says whether I could **fetch** the page or only saw it **via search results**. Where the page itself was unreachable (HTTP 403/522), I describe only what the search results confirmed. I did not fill in layout details from memory.

Fetch status:

- Fetched successfully: TensorFlow Playground, Distill, the SHAP docs, Telea Decision Maps, GSAP docs, Practical Typography, Storybench.
- Unreachable: R2D3 returned 522, Bloomberg returned 403 and Codrops returned 403.

---

## 1. Visual composition: R2D3, "A Visual Introduction to Machine Learning"

- URL: http://www.r2d3.us/visual-intro-to-machine-learning-part-1/ (the page returned 522 when fetched; its content is confirmed by search results and secondary write-ups: https://datainnovation.org/2015/08/visualizing-how-machines-learn/ and https://wikidocs.net/blog/@jaehong/9239/)
- What the sources confirm:
  - The piece is by Stephanie Yee and Tony Chu.
  - One housing dataset (NYC vs SF homes) is carried through the whole scroll.
  - The decision tree grows one split at a time as you scroll.
  - Moving a split point to one side raises false positives, and moving it to the other side raises false negatives. The effect shows in real time.
- **What I learned:**
  - *One population of marks, many arrangements.* The same data points are re-sorted at each step instead of being replaced by a new chart. Continuity of identity is what makes the explanation feel physical.
  - A split shown *as a consequence for errors* (FP vs FN) teaches the decision boundary better than a line on its own.
- **How PREDICTIVE differs:**
  - R2D3 teaches a *training* algorithm with toy-like splits.
  - PREDICTIVE uses a *shipped* model's real outputs, and its boundary is not drawn by an author. It is computed live in the browser by the ONNX ensemble.
  - We borrow only the principle "the same particles persist through every beat". Our particles are 400 named, real held-out customers, and the "split" is a cost-derived threshold (0.10, FN $500 vs FP $50). That threshold is not a tree node.

## 2. Visual composition: Bloomberg, "What's Really Warming the World?"

- URL: https://www.bloomberg.com/graphics/2015-whats-warming-the-world/ (the page returned 403 when fetched; confirmed via https://cleanet.org/resources/51236.html, https://climate.gov/teaching/resources/whats-really-warming-the-world-29366 and https://blogs.scu.edu/dataviz/?p=1103)
- What the sources confirm:
  - The piece was made in 2015 by Eric Roston and Blacki Migliozzi with NASA GISS.
  - It is a *series of animated steps* that compares each candidate cause of warming against the observed record.
  - Only one factor tracks the observed line, and the reader learns that by elimination, one step at a time.
- **What I learned:**
  - *A single persistent frame of reference with one hypothesis added per step.* The reader never re-learns the axes, so each step costs one idea, not a new chart.
  - The argument is made by *comparison against ground truth*.
- **How PREDICTIVE differs:**
  - Our persistent frame is a 2D *probability terrain*, not a time series.
  - The "hypotheses" are not authored overlays. The visitor edits a customer and the model's own landscape redraws.
  - We adopt the discipline of one changed variable per narrative step, and of always showing ground truth: each point carries its real `actual_churn` ring. We do not adopt its line-chart form or its white editorial page.

## 3. Interaction: TensorFlow Playground

- URL: https://playground.tensorflow.org/ (fetched)
- What the page confirms:
  - "Orange and blue" encode the two classes.
  - "The intensity of the color shows how confident that prediction is" in the background.
  - Data points are small circles colored by their true value.
  - There is a "Discretize output" toggle.
- **What I learned:**
  - The most legible encoding for a classifier is a *continuous background field* (prediction) under *discrete points* (truth), where intensity encodes confidence.
  - The discretize toggle shows that visitors benefit from switching between "probability" and "decision" views of the same field.
  - The tool also shows that direct manipulation beats forms: you change a control and the whole field re-renders.
- **How PREDICTIVE differs:**
  - The Playground *trains* a toy net on synthetic 2D data, where the two axes ARE the whole input space.
  - PREDICTIVE's model is 19-dimensional and already trained. Our field is an honest *2D slice*: tenure × monthly charge, with the other 17 features held at one real customer's values.
  - When you change Contract or Internet type, the *whole slice re-computes* through the real ONNX ensemble. That is a different and stronger claim.
  - We also replace orange/blue with the mandated mint/coral on near-black, and our "discretize" view is the cost-optimal threshold of 0.10, not 0.5.

## 4. Interaction / motion: Distill, "Communicating with Interactive Articles"

- URL: https://distill.pub/2020/communicating-with-interactive-articles/ (fetched)
- What the page confirms:
  - Link related representations: hovering a term highlights its counterpart.
  - Use animation "for change, not decoration": transitions, causality, narrative.
  - Let readers control pacing.
  - Ask the reader to *predict before revealing*, as in "You Draw It".
  - It warns that interactivity can go unused, that accessibility is unsolved, and that "Performance and devices matter".
- **What I learned:**
  - Three concrete rules made it into the motion bible:
    - Every animation must encode a state change.
    - Every hover in text must light its mark, and the reverse.
    - The reader can scrub or skip any choreographed sequence.
  - The predict-first idea became the "Call it" moment in the Prediction beat. Before the model answers, the visitor guesses whether customer #276 churned.
- **How PREDICTIVE differs:** Distill is a long-form research article format. We use its evidence-based rules, not its look (white page, serif body). Our page is a dark, full-bleed instrument.

## 5. Motion: GSAP ScrollTrigger documentation

- URL: https://gsap.com/docs/v3/Plugins/ScrollTrigger/ (fetched). A related Codrops tutorial, https://tympanus.net/codrops/2025/11/19/how-to-build-cinematic-3d-scroll-experiences-with-gsap/, was found via search but returned 403. Search results confirm it maps scroll progress to camera paths for a particle scene.
- What the GSAP page confirms:
  - `scrub: true` ties progress to scroll.
  - A numeric scrub value adds catch-up smoothing in seconds.
  - Pins should animate *children*, not the pinned element.
  - Positions are precalculated and need `refresh()` after layout changes.
  - ScrollTrigger "doesn't hijack scrolling".
- **What I learned:**
  - The right model for a scroll story is **scroll position → normalized progress → state interpolation**, with smoothing applied to the *visual*, never to the scroll itself. Never scroll-jack.
  - "Animate children of the pinned element" maps directly onto our design: the sticky canvas container never transforms, and only the canvas contents change.
- **How PREDICTIVE differs:**
  - We deliberately do **not** add GSAP. It is not installed, and our needs are covered by what is installed: `d3` (`d3-ease`, `d3-timer`, `d3-interpolate`) plus `IntersectionObserver` and CSS `position: sticky`.
  - We keep ScrollTrigger's *architecture* (progress-driven, smoothed, no hijack) and implement it in roughly 60 lines.
  - See `approved/motion-bible.md`.

## 6. Typography / editorial: Butterick's Practical Typography, plus The Pudding's story shape

- URLs: https://practicaltypography.com/line-length.html (fetched) and https://www.storybench.org/?p=8613, "How The Pudding structures stories as visual essays" (Storybench, 2018, fetched)
- What the pages confirm:
  - Butterick: "Aim for an average line length of 45–90 characters", which is "two to three alphabets".
  - Storybench on The Pudding:
    - Visual essays are "usually sparse on words".
    - Data and design "have to work together to carry the narrative".
    - Story shape varies. One piece opens on about 7,000 dots, narrows to 11, and then widens into a "giant sad wall".
- **What I learned:**
  - Prose blocks over the canvas must be narrow: we cap them at 38–56ch, the tight end of Butterick's range, because they sit over a moving field.
  - Text is a caption to the marks, not an essay.
  - The Pudding's V-shaped arc maps onto our narrative almost exactly. It goes from 400 customers, narrows to one customer (#276), then widens again to 1,409 held-out customers in Evaluation.
- **How PREDICTIVE differs:** The Pudding uses a light editorial page with mostly SVG charts. We use a dark scientific-instrument language: an editorial grotesk for claims and monospace for every number the model produced. The typographic split itself signals provenance (see `approved/typography.md`).

## 7. Domain: SHAP waterfall plot documentation

- URL: https://shap.readthedocs.io/en/latest/example_notebooks/api_examples/plots/waterfall.html (fetched)
- What the page confirms:
  - A waterfall explains one prediction.
  - It starts at E[f(X)] and moves to f(x).
  - Red bars push the output up and blue bars push it down.
  - The default `max_display=10` folds the rest into "other features".
  - For tree classifiers, SHAP explains the margin *before the link function*, so the axis is in log-odds.
- **What I learned, and the constraints it exposed in our fixtures:**
  1. A true waterfall needs the base value E[f(X)]. **Our `feature.explanations.json` has no base value**, and `per_row` stores only the **top 8** factors. So we cannot honestly draw a full waterfall from baseline to f(x). We draw a **ranked log-odds contribution ledger** with an explicit "remaining 11+ encoded features not stored" row.
  2. The values are in **HGB log-odds space, not the calibrated probability**, exactly as the fixture's own `space` field states. The bars must never land on, or be summed into, the calibrated probability shown in the Lab.
  3. The SHAP features are **one-hot columns**. For example, `cat__InternetService_Fiber optic = −0.31` for customer #276, who has *DSL*. That value means "not having fiber lowers the risk". We need a labeling rule (see `approved/interaction-map.md`).
- **How PREDICTIVE differs:**
  - We keep SHAP's semantic of up versus down, but recolor it to coral (raises churn risk) and mint (lowers it), on our palette.
  - We add a second, visually distinct explanation type, **live sensitivity**. It shows exact model deltas from the ONNX ensemble, drawn hatched and outlined. It is used whenever the visitor has edited the customer, because SHAP exists only for the 400 unedited fixture rows.

## 8. Domain: Telea et al., Decision Maps (Utrecht University)

- URL: https://webspace.science.uu.nl/~telea001/VisualAnalytics/DecMaps (fetched)
- What the page confirms:
  - Decision maps project nD data to 2D, then inverse-project every pixel back to nD and classify it.
  - Color encodes the predicted class, so zones meet at boundaries.
  - A luminance variant encodes the distance to the nearest decision boundary.
  - Misclassifications are drawn as distinct markers.
- **What I learned:**
  - The pixel-dense field is the correct visual idiom for "where the classifier says what".
  - Luminance-as-closeness-to-boundary is a strong second channel.
  - The inverse-projection caveat is real: a 2D picture of a 19-D model is always a *choice*, and it must be stated.
- **How PREDICTIVE differs:**
  - We avoid inverse projection entirely, because it would be an approximation we would have to explain away.
  - Our 2D plane uses two *real, human-meaningful* axes (tenure, monthly charge), with every other feature held at a real customer's values. TotalCharges is derived as tenure × monthly charge.
  - Every pixel is therefore an exact model output for a nameable hypothetical customer. We borrow the luminance idea as **iso-bands**: brightness rises near the 0.10 contour.
  - We borrow the misclassification marker as the `actual_churn` ring.

---

## Facts measured from the repo's real fixtures while researching

These were measured with `onnxruntime-node` and the real `fold_*.onnx` and `calibrators.json`. They change the design:

- **Threshold:** the shipped decision threshold is **0.10**, not 0.5 (`calibrators.json`).
  - Of the 400 sample customers, 268 are predicted "churn".
  - At 0.10 on the 400-customer sample: TP 114, FP 154, TN 126, FN 6.
  - The per-model confusion matrices in `model.metrics.json` are at **0.5**. Only `cost_threshold_metrics` is at 0.10.
- **Slices without a boundary:** in **174 of 400** customers' tenure × monthly-charge slices, every cell is ≥ 0.10. That profile is flagged everywhere on the plane, so no 0.10 boundary exists in that slice. 134 slices contain a clearly visible boundary.
  - The terrain therefore must always show continuous probability bands, and it must state "no boundary in this slice" honestly when that is the case.
- **Focal customer #276** (Female, 10 mo, $55.20, Month-to-month, DSL, actually churned):
  - Real p = **0.217**, so she is on the churn side.
  - Dragging tenure to 24 months gives p = **0.092** and she crosses the boundary.
  - Contract → One year gives **0.079**.
  - InternetService → Fiber gives **0.359**.
  - Her slice is 62% churn-side, so the boundary is visible.
- **Performance:** batched inference works. The ONNX inputs have a dynamic batch dimension.
  - A 48×32 grid (1,536 rows × 5 folds) ran in about 26 ms in Node.
  - Expect several times slower in the wasm build.
- **Parity caveat for site copy:** JS inference matches sklearn within 1e-4 on **398 of 400** rows. Rows 25 and 364 deviate by 0.0072 and 0.0119, with no class flips at 0.10.
  - The existing test checks only 25 rows, at a step of 16.
  - Site copy must say "matches scikit-learn within 1e-4 on 398 of 400 held-out rows (max deviation 0.012)". It must not say "byte-identical".
- **Sample vs full test set:**
  - On the 400-customer sample, the calibrated ROC-AUC is 0.854 and the Brier score is 0.141. Churners make up 30% of the sample, against 26.5% in the full test set.
  - Headline metrics must come from `model.metrics.json` (n = 1,409) and be labeled as such. Sample-derived curves must be labeled "sample, n = 400".
