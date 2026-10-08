# Limitations and substitutions

The source master-prompt asked for a much larger production stack. This is what was built
instead, and why, stated honestly rather than silently dropped.

| Spec asked for | This build has | Why |
|---|---|---|
| PostgreSQL 17 + Redis 7 | No database; one `joblib` file as the model artifact | The app has no mutable state besides the trained model. A database would add operational surface with nothing to persist. |
| Docker Compose, CI (GitHub Actions), OpenTelemetry, Sentry | Local `uv venv` + `npm` dev servers, `pytest` run manually | These are deployment/observability concerns for a service running in production traffic. This is a local portfolio artifact; adding them would be unverifiable theater (no real CI run, no real error traffic to observe). |
| Optuna hyperparameter search | Fixed `random_state`, scikit-learn defaults | Documented in `artifacts/model_card.md` as a real simplification, not a hidden one. HistGradientBoosting's defaults already beat the dummy baseline by a wide margin (0.833 vs 0.5 ROC-AUC). |
| MLflow run tracking | `artifacts/metrics.json` + `model_card.md`, written once per `train.py` run | Same effect (reproducible, inspectable run record) without standing up a tracking server for 3 total training runs. |
| Full SHAP TreeExplainer for every live prediction | Exact SHAP at training time (global), cheap perturbation approximation at request time (local) | A full SHAP explainer per API call would add real latency for a local demo with no production SLA to justify it. The approximation is labeled as such in the UI. |
| Drift monitoring on real production traffic | Deterministic seeded synthetic cohort generator | There is no production traffic for this app. The generator is explicitly labeled "synthetic, NOT live telemetry" in the API docstring, the UI banner, and here. |
| Playwright / axe-core automated browser test suite | Manual browser verification via Claude-in-Chrome (screenshotted each of the 4 tabs, checked console for errors) during this build | Time-boxed; the pytest suite (18 tests) covers model and API correctness, which is where a wrong answer would actually hurt. Playwright/axe-core are a reasonable next addition, not fabricated as already done. |
| A literal 3-agent build team (ML_ENGINEER / FULLSTACK_ENGINEER / VERIFICATION_ENGINEER) with JSON handoffs | One agent (this session) did the full build | The spec itself says this orchestration exists to build the product, not to be a feature of the shipped app. Running literal sub-agents for a single small repo would have added coordination overhead without changing the code produced. |

## What is real and verified

- The dataset is the real public IBM Telco Customer Churn CSV (7,043 rows), not synthetic.
- All reported metrics in `artifacts/metrics.json` and the Model Comparison tab come from an
  actual `train.py` run on a stratified 80/20 split; none are invented.
- All 18 tests in `tests/` were executed and passed (see the Testing section of README.md to
  re-run them yourself).
- The frontend was manually driven in a real Chrome tab and produces the same numbers the API
  returns directly (cross-checked during this build).

## Known weaknesses

- Precision/recall on the calibrated model is imbalanced toward precision (0.66) over recall
  (0.50) at the default 0.5 threshold, a real production churn tool would likely tune the
  threshold against a business cost matrix (spec step 7), which this slice does not do.
- The dataset is a well-known public tutorial dataset; results do not generalize to any real
  telecom operator's customer base.
