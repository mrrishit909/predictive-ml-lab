# Model Card, PREDICTIVE churn model

## Data
- Source: IBM Telco Customer Churn (public sample dataset), 7043 customers after de-duplication.
- Provenance: downloaded from https://github.com/IBM/telco-customer-churn-on-icp4d
- Churn base rate: 0.265
- TotalCharges had 11 blank values (new customers with tenure=0); imputed to 0.0, not dropped.

## Models compared
Dummy (most-frequent baseline), LogisticRegression (class-balanced), HistGradientBoostingClassifier.
Selected: **hist_gradient_boosting**, isotonic-calibrated for the shipped model.

## Held-out test metrics (20% stratified split, never used in training or CV)
See artifacts/metrics.json for exact numbers per model.

## Optuna hyperparameter search (HistGradientBoostingClassifier)
- Search space: `max_iter` [50,300], `max_depth` [2,12], `learning_rate` [0.01,0.3] (log scale),
  `max_leaf_nodes` [8,64], `l2_regularization` [0.0,1.0], `min_samples_leaf` [5,50].
- Objective: mean 5-fold stratified `cross_val_score` ROC-AUC, evaluated ONLY on the 80% training
  split (X_train/y_train) - X_test was never touched during the search.
- 25 trials, TPE sampler, seed=42.
- Best params found: {"max_iter": 230, "max_depth": 4, "learning_rate": 0.013762293618959916, "max_leaf_nodes": 57, "l2_regularization": 0.2120765203480802, "min_samples_leaf": 34}
- Best CV ROC-AUC during search: 0.8499

## MLflow experiment tracking
- Local file-based tracking store at `./mlruns`, experiment `predictive-churn`.
- One run per candidate model (dummy, logistic_regression, hist_gradient_boosting) logging
  params, the full metrics dict, and this model card as an artifact.

## Business-cost-based threshold optimization
Cost assumptions are **illustrative, not real business data** (this is a public tutorial
dataset), documented here for transparency:
- Cost of a false negative (missed churner): $500
- Cost of a false positive (unneeded retention offer): $50

The threshold was chosen by sweeping 0.05 .. 0.95
(19 steps) against expected cost = COST_FN*FN + COST_FP*FP computed from
**out-of-fold predictions on the training split only** (`cross_val_predict` with the same
StratifiedKFold used for model selection; X_test was never used to choose this threshold).

- Chosen threshold: **0.10**
- Expected cost at chosen threshold (OOF, training split): $144300
- Expected cost at default 0.5 threshold (OOF, training split): $370700

Held-out TEST metrics at this chosen threshold (recomputed separately from the existing 0.5-
threshold numbers in `metrics.json["results"]`, see `metrics.json["cost_threshold_metrics"]`):
precision=0.392, recall=0.957,
f1=0.556, confusion_matrix={'tn': 480, 'fp': 555, 'fn': 16, 'tp': 358}.

## Known limitations
- This is a public tutorial-grade dataset, not live production telemetry; results do not
  represent any real telecom operator.
- Drift monitoring in this app uses a deterministic synthetic shift generator, not real
  incoming traffic.
- The business cost constants above are illustrative assumptions for demonstrating the
  methodology, not sourced from any real telecom operator's unit economics.
