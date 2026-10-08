# Model Card, PREDICTIVE churn model

## Data
- Source: IBM Telco Customer Churn (public sample dataset), 7043 customers after de-duplication.
- Provenance: downloaded from https://github.com/IBM/telco-customer-churn-on-icp4d
- Churn base rate: 0.265
- TotalCharges had 11 blank values (new customers with tenure=0); imputed to 0.0, not dropped.

## Models compared
Dummy (most-frequent baseline), LogisticRegression (class-balanced), HistGradientBoostingClassifier.
Selected: **logistic_regression**, isotonic-calibrated for the shipped model.

## Held-out test metrics (20% stratified split, never used in training or CV)
See artifacts/metrics.json for exact numbers per model.

## Known limitations
- This is a public tutorial-grade dataset, not live production telemetry; results do not
  represent any real telecom operator.
- Drift monitoring in this app uses a deterministic synthetic shift generator, not real
  incoming traffic.
- No hyperparameter search (Optuna) was run; HistGradientBoosting uses scikit-learn defaults
  plus a fixed random_state. This is a documented simplification, not a hidden shortcut.
