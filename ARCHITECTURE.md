# Architecture

```
data/raw/Telco-Customer-Churn.csv
        |
        v
ml/train.py  --(fits)-->  ColumnTransformer(StandardScaler, OneHotEncoder)
                           |
                           v
                   3 candidate classifiers (cross_val_score, 5-fold stratified)
                           |
                           v
                   best non-dummy model -> CalibratedClassifierCV (isotonic)
                           |
                           v
          artifacts/{model.joblib, metrics.json, shap_summary.json, model_card.md}
                           |
                           v
api/main.py (FastAPI)  loads artifacts/model.joblib at startup
  /predict, /predict/batch   -> model.predict_proba on Pydantic-validated input
  /explain/global            -> precomputed SHAP summary (training-time)
  /explain/local             -> live perturbation delta (prediction-time)
  /drift                     -> seeded synthetic cohort generator + model.predict_proba
                           |
                           v
web/ (React + Vite)  calls the API over /api/* (Vite dev proxy -> :8000)
  Intro.tsx            canvas decision-boundary animation
  App.tsx              4 tabs: PredictionStudio, Explainability, ModelComparison, DriftDashboard
```

## Design decisions

- **Feature contract lives in one place** (`ml/schema.py`): both the training pipeline and the
  API's Pydantic model import the same `ALL_FEATURES` / `CATEGORY_VALUES`, so the model is
  never trained on a column the API doesn't send, or vice versa.
- **No separate train/test leakage**: the ColumnTransformer is fit fresh inside `Pipeline`,
  itself refit per cross-validation fold by `cross_val_score`, and the final fit never sees
  `X_test`. `tests/test_model.py::test_no_future_leakage_cv_mean_close_to_test_auc` is the
  regression guard for this.
- **Calibration**: the raw best model (by ROC-AUC) is wrapped in `CalibratedClassifierCV`
  (isotonic, 5-fold internal CV) before being shipped, because churn probabilities are shown
  directly to the user and an uncalibrated score would be misleading as a probability.
- **Explainability has two tiers on purpose**: exact SHAP (`shap.Explainer` /
  `shap.TreeExplainer`-eligible model) computed once at training time for the global view, and a
  cheap per-feature mean/mode perturbation for the local, per-request view, to keep `/predict`
  latency low without running a model-agnostic SHAP explainer on every API call.
- **Drift is synthetic and labeled as such** everywhere it appears (API docstring, UI banner,
  README, model card) rather than silently presented as if it were live monitoring.
- **Single-process deployment**: API and frontend are two local dev servers connected by a Vite
  proxy. There is no Docker Compose, Postgres, or Redis in this slice (see LIMITATIONS.md), the
  app's actual state is one `joblib` file, which doesn't need a database.
