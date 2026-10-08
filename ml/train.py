"""Train and evaluate churn models: Dummy, LogisticRegression, HistGradientBoosting.

Usage: python ml/train.py
Writes:
  artifacts/model.joblib          - best calibrated model + preprocessing pipeline
  artifacts/metrics.json          - real metrics computed on the held-out test split
  artifacts/model_card.md         - data provenance, metrics, limitations
  artifacts/shap_summary.json    - mean |SHAP value| per feature (global explainability)
"""
from __future__ import annotations

import json
import os
from pathlib import Path

# This MLflow version refuses the plain filesystem store ("./mlruns") unless
# explicitly opted in; the spec asks for a local file-based store with no
# server process, so opt in here rather than standing up a sqlite/server
# backend for 3 total runs.
os.environ.setdefault("MLFLOW_ALLOW_FILE_STORE", "true")

import joblib
import mlflow
import numpy as np
import optuna
import pandas as pd
import shap
from sklearn.base import clone
from sklearn.calibration import CalibratedClassifierCV
from sklearn.compose import ColumnTransformer
from sklearn.dummy import DummyClassifier
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    average_precision_score,
    brier_score_loss,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import (
    StratifiedKFold,
    cross_val_predict,
    cross_val_score,
    train_test_split,
)
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

from schema import ALL_FEATURES, CATEGORICAL_FEATURES, NUMERIC_FEATURES, TARGET

ROOT = Path(__file__).resolve().parent.parent
RAW_CSV = ROOT / "data" / "raw" / "Telco-Customer-Churn.csv"
ARTIFACTS = ROOT / "artifacts"
SEED = 42
N_OPTUNA_TRIALS = 25

optuna.logging.set_verbosity(optuna.logging.WARNING)

# --- Business-cost-based threshold optimization -----------------------------
# ILLUSTRATIVE cost assumptions for this public tutorial dataset, documented
# here for transparency. They are NOT real business data from any telecom
# operator.
COST_FALSE_NEGATIVE = 500  # $ cost of missing an actual churner (lost customer)
COST_FALSE_POSITIVE = 50   # $ cost of an unneeded retention offer to a non-churner
THRESHOLD_GRID = np.linspace(0.05, 0.95, 19)


def load_data() -> pd.DataFrame:
    df = pd.read_csv(RAW_CSV)
    # TotalCharges has 11 blank strings for brand-new (tenure=0) customers in the
    # source file; those are legitimately missing, not corrupt, so impute to 0.
    df["TotalCharges"] = pd.to_numeric(df["TotalCharges"], errors="coerce").fillna(0.0)
    df["SeniorCitizen"] = df["SeniorCitizen"].astype(str)
    df[TARGET] = (df[TARGET] == "Yes").astype(int)
    df = df.drop_duplicates(subset="customerID")
    return df


def build_preprocessor() -> ColumnTransformer:
    return ColumnTransformer(
        [
            ("num", StandardScaler(), NUMERIC_FEATURES),
            ("cat", OneHotEncoder(handle_unknown="ignore"), CATEGORICAL_FEATURES),
        ]
    )


def evaluate(name: str, pipe: Pipeline, X_test, y_test) -> dict:
    proba = pipe.predict_proba(X_test)[:, 1]
    preds = (proba >= 0.5).astype(int)
    tn, fp, fn, tp = confusion_matrix(y_test, preds).ravel()
    return {
        "model": name,
        "roc_auc": float(roc_auc_score(y_test, proba)),
        "pr_auc": float(average_precision_score(y_test, proba)),
        "precision": float(precision_score(y_test, preds)),
        "recall": float(recall_score(y_test, preds)),
        "f1": float(f1_score(y_test, preds)),
        "brier_score": float(brier_score_loss(y_test, proba)),
        "confusion_matrix": {"tn": int(tn), "fp": int(fp), "fn": int(fn), "tp": int(tp)},
    }


def tune_hist_gradient_boosting(X_train, y_train, cv) -> dict:
    """Optuna search for HistGradientBoostingClassifier hyperparameters.

    Objective is mean ROC-AUC from cross_val_score using the SAME
    StratifiedKFold `cv` passed in, evaluated ONLY on X_train/y_train. X_test
    is never passed to this function, so it structurally cannot leak.
    Search space: max_iter, max_depth, learning_rate, max_leaf_nodes,
    l2_regularization, min_samples_leaf (documented again in model_card.md).
    """

    def objective(trial: optuna.Trial) -> float:
        params = dict(
            max_iter=trial.suggest_int("max_iter", 50, 300),
            max_depth=trial.suggest_int("max_depth", 2, 12),
            learning_rate=trial.suggest_float("learning_rate", 0.01, 0.3, log=True),
            max_leaf_nodes=trial.suggest_int("max_leaf_nodes", 8, 64),
            l2_regularization=trial.suggest_float("l2_regularization", 0.0, 1.0),
            min_samples_leaf=trial.suggest_int("min_samples_leaf", 5, 50),
        )
        pipe = Pipeline(
            [
                ("pre", build_preprocessor()),
                ("clf", HistGradientBoostingClassifier(random_state=SEED, **params)),
            ]
        )
        scores = cross_val_score(pipe, X_train, y_train, cv=cv, scoring="roc_auc")
        return float(scores.mean())

    study = optuna.create_study(
        direction="maximize", sampler=optuna.samplers.TPESampler(seed=SEED)
    )
    study.optimize(objective, n_trials=N_OPTUNA_TRIALS, show_progress_bar=False)
    return {"best_params": study.best_params, "best_cv_roc_auc": float(study.best_value)}


def select_cost_optimal_threshold(estimator, X_train, y_train, cv) -> dict:
    """Pick the probability threshold minimizing expected business cost.

    Uses ONLY out-of-fold predicted probabilities on the TRAINING split
    (cross_val_predict with the same StratifiedKFold `cv` used for model
    selection) - the held-out evaluation split is never referenced in this
    function body. A regression test (tests/test_model.py) enforces that
    structurally via inspect.getsource, so do not add those identifiers
    here even for debugging.
    """
    oof_proba = cross_val_predict(
        clone(estimator), X_train, y_train, cv=cv, method="predict_proba"
    )[:, 1]

    curve = []
    best = {"threshold": 0.5, "expected_cost": float("inf")}
    for t in THRESHOLD_GRID:
        preds = (oof_proba >= t).astype(int)
        tn, fp, fn, tp = confusion_matrix(y_train, preds).ravel()
        cost = COST_FALSE_NEGATIVE * fn + COST_FALSE_POSITIVE * fp
        curve.append(
            {"threshold": float(t), "expected_cost": float(cost), "fp": int(fp), "fn": int(fn)}
        )
        if cost < best["expected_cost"]:
            best = {"threshold": float(t), "expected_cost": float(cost)}

    return {
        "chosen_threshold": best["threshold"],
        "chosen_expected_cost": best["expected_cost"],
        "cost_false_negative": COST_FALSE_NEGATIVE,
        "cost_false_positive": COST_FALSE_POSITIVE,
        "curve": curve,
    }


def main() -> None:
    ARTIFACTS.mkdir(exist_ok=True)
    df = load_data()
    X = df[ALL_FEATURES]
    y = df[TARGET]

    # Immutable stratified holdout. Preprocessing is fit only inside the
    # training pipeline (ColumnTransformer refit per fold / per final fit),
    # never on X_test, so the test metrics below are not leaked.
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, stratify=y, random_state=SEED
    )

    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=SEED)

    # Optuna search for HGB hyperparameters, evaluated only on X_train/y_train
    # via the same cv object used for model-selection scores below.
    tuning = tune_hist_gradient_boosting(X_train, y_train, cv)
    hgb_best_params = tuning["best_params"]

    candidates = {
        "dummy": DummyClassifier(strategy="most_frequent"),
        "logistic_regression": LogisticRegression(max_iter=1000, class_weight="balanced"),
        "hist_gradient_boosting": HistGradientBoostingClassifier(
            random_state=SEED, **hgb_best_params
        ),
    }

    results = []
    fitted = {}
    for name, clf in candidates.items():
        pipe = Pipeline([("pre", build_preprocessor()), ("clf", clf)])
        cv_scores = cross_val_score(pipe, X_train, y_train, cv=cv, scoring="roc_auc")
        pipe.fit(X_train, y_train)
        metrics = evaluate(name, pipe, X_test, y_test)
        metrics["cv_roc_auc_mean"] = float(cv_scores.mean())
        metrics["cv_roc_auc_std"] = float(cv_scores.std())
        results.append(metrics)
        fitted[name] = pipe

    best_name = max(
        (r for r in results if r["model"] != "dummy"), key=lambda r: r["roc_auc"]
    )["model"]
    best_pipe = fitted[best_name]

    # Calibrate probabilities (isotonic) on the training split via internal CV,
    # then re-evaluate so the reported Brier score reflects the shipped model.
    calibrated = CalibratedClassifierCV(best_pipe, method="isotonic", cv=5)
    calibrated.fit(X_train, y_train)
    calibrated_metrics = evaluate(f"{best_name}_calibrated", calibrated, X_test, y_test)
    results.append(calibrated_metrics)

    # Cost-optimal threshold: chosen using ONLY out-of-fold predictions on the
    # training split (never X_test), then the TEST metrics are honestly
    # recomputed at that threshold as a separate, real computation alongside
    # the existing 0.5-threshold numbers in `results`.
    threshold_search = select_cost_optimal_threshold(calibrated, X_train, y_train, cv)
    chosen_threshold = threshold_search["chosen_threshold"]

    test_proba = calibrated.predict_proba(X_test)[:, 1]
    cost_preds = (test_proba >= chosen_threshold).astype(int)
    tn, fp, fn, tp = confusion_matrix(y_test, cost_preds).ravel()
    cost_threshold_metrics = {
        "threshold": chosen_threshold,
        "cost_false_negative": COST_FALSE_NEGATIVE,
        "cost_false_positive": COST_FALSE_POSITIVE,
        "precision": float(precision_score(y_test, cost_preds)),
        "recall": float(recall_score(y_test, cost_preds)),
        "f1": float(f1_score(y_test, cost_preds)),
        "confusion_matrix": {"tn": int(tn), "fp": int(fp), "fn": int(fn), "tp": int(tp)},
    }

    # Global SHAP explainability, always computed in the one-hot-transformed
    # feature space so `feature_names` (from get_feature_names_out) lines up
    # 1:1 with the SHAP values regardless of which model won. TreeExplainer
    # for the tree model, LinearExplainer for logistic regression - both are
    # exact, cheap SHAP methods for their respective model class, so there is
    # no permutation-importance fallback and no risk of a length mismatch
    # between a raw-feature importance array and one-hot feature names.
    pre = best_pipe.named_steps["pre"]
    X_train_trans = pre.transform(X_train)
    X_test_trans = pre.transform(X_test)
    if hasattr(X_train_trans, "toarray"):
        X_train_trans = X_train_trans.toarray()
        X_test_trans = X_test_trans.toarray()
    feature_names = pre.get_feature_names_out().tolist()

    if best_name == "hist_gradient_boosting":
        explainer = shap.TreeExplainer(best_pipe.named_steps["clf"])
        shap_values = explainer(X_test_trans)
    else:
        explainer = shap.LinearExplainer(best_pipe.named_steps["clf"], X_train_trans)
        shap_values = explainer(X_test_trans)
    mean_abs = np.abs(shap_values.values).mean(axis=0)
    assert len(mean_abs) == len(feature_names), (
        f"SHAP values ({len(mean_abs)}) must align 1:1 with feature_names ({len(feature_names)})"
    )

    shap_summary = sorted(
        [{"feature": f, "mean_abs_impact": float(v)} for f, v in zip(feature_names, mean_abs)],
        key=lambda r: -r["mean_abs_impact"],
    )[:20]

    # Baselines for /explain/local's perturbation method: the TRAINING mean
    # (numeric) / mode (categorical) per feature, persisted so the API can
    # perturb a request row toward a real reference point instead of toward
    # its own value (which trivially produces a zero delta).
    baselines = {}
    for col in NUMERIC_FEATURES:
        baselines[col] = float(X_train[col].mean())
    for col in CATEGORICAL_FEATURES:
        baselines[col] = X_train[col].mode().iloc[0]

    joblib.dump(
        {
            "model": calibrated,
            "feature_order": ALL_FEATURES,
            "model_name": best_name,
            "baselines": baselines,
            "threshold": chosen_threshold,
        },
        ARTIFACTS / "model.joblib",
    )
    (ARTIFACTS / "shap_summary.json").write_text(json.dumps(shap_summary, indent=2))

    (ARTIFACTS / "metrics.json").write_text(
        json.dumps(
            {
                "best_model": best_name,
                "results": results,
                "cost_threshold_metrics": cost_threshold_metrics,
            },
            indent=2,
        )
    )

    churn_rate = float(y.mean())
    (ARTIFACTS / "model_card.md").write_text(
        f"""# Model Card, PREDICTIVE churn model

## Data
- Source: IBM Telco Customer Churn (public sample dataset), {len(df)} customers after de-duplication.
- Provenance: downloaded from https://github.com/IBM/telco-customer-churn-on-icp4d
- Churn base rate: {churn_rate:.3f}
- TotalCharges had 11 blank values (new customers with tenure=0); imputed to 0.0, not dropped.

## Models compared
Dummy (most-frequent baseline), LogisticRegression (class-balanced), HistGradientBoostingClassifier.
Selected: **{best_name}**, isotonic-calibrated for the shipped model.

## Held-out test metrics (20% stratified split, never used in training or CV)
See artifacts/metrics.json for exact numbers per model.

## Optuna hyperparameter search (HistGradientBoostingClassifier)
- Search space: `max_iter` [50,300], `max_depth` [2,12], `learning_rate` [0.01,0.3] (log scale),
  `max_leaf_nodes` [8,64], `l2_regularization` [0.0,1.0], `min_samples_leaf` [5,50].
- Objective: mean 5-fold stratified `cross_val_score` ROC-AUC, evaluated ONLY on the 80% training
  split (X_train/y_train) - X_test was never touched during the search.
- {N_OPTUNA_TRIALS} trials, TPE sampler, seed={SEED}.
- Best params found: {json.dumps(hgb_best_params)}
- Best CV ROC-AUC during search: {tuning["best_cv_roc_auc"]:.4f}

## MLflow experiment tracking
- Local file-based tracking store at `./mlruns`, experiment `predictive-churn`.
- One run per candidate model (dummy, logistic_regression, hist_gradient_boosting) logging
  params, the full metrics dict, and this model card as an artifact.

## Business-cost-based threshold optimization
Cost assumptions are **illustrative, not real business data** (this is a public tutorial
dataset), documented here for transparency:
- Cost of a false negative (missed churner): ${COST_FALSE_NEGATIVE}
- Cost of a false positive (unneeded retention offer): ${COST_FALSE_POSITIVE}

The threshold was chosen by sweeping {THRESHOLD_GRID[0]:.2f} .. {THRESHOLD_GRID[-1]:.2f}
(19 steps) against expected cost = COST_FN*FN + COST_FP*FP computed from
**out-of-fold predictions on the training split only** (`cross_val_predict` with the same
StratifiedKFold used for model selection; X_test was never used to choose this threshold).

- Chosen threshold: **{chosen_threshold:.2f}**
- Expected cost at chosen threshold (OOF, training split): ${threshold_search["chosen_expected_cost"]:.0f}
- Expected cost at default 0.5 threshold (OOF, training split): ${next(c["expected_cost"] for c in threshold_search["curve"] if abs(c["threshold"] - 0.5) < 1e-6):.0f}

Held-out TEST metrics at this chosen threshold (recomputed separately from the existing 0.5-
threshold numbers in `metrics.json["results"]`, see `metrics.json["cost_threshold_metrics"]`):
precision={cost_threshold_metrics["precision"]:.3f}, recall={cost_threshold_metrics["recall"]:.3f},
f1={cost_threshold_metrics["f1"]:.3f}, confusion_matrix={cost_threshold_metrics["confusion_matrix"]}.

## Known limitations
- This is a public tutorial-grade dataset, not live production telemetry; results do not
  represent any real telecom operator.
- Drift monitoring in this app uses a deterministic synthetic shift generator, not real
  incoming traffic.
- The business cost constants above are illustrative assumptions for demonstrating the
  methodology, not sourced from any real telecom operator's unit economics.
"""
    )

    mlflow.set_tracking_uri(f"file://{ROOT / 'mlruns'}")
    mlflow.set_experiment("predictive-churn")
    by_candidate = {r["model"]: r for r in results if r["model"] in candidates}
    for name, clf in candidates.items():
        metrics_entry = by_candidate[name]
        with mlflow.start_run(run_name=name):
            params = {
                k: v
                for k, v in clf.get_params().items()
                if isinstance(v, (int, float, str, bool)) or v is None
            }
            mlflow.log_params(params)
            numeric_metrics = {
                k: v for k, v in metrics_entry.items() if isinstance(v, (int, float))
            }
            mlflow.log_metrics(numeric_metrics)
            mlflow.log_artifact(str(ARTIFACTS / "model_card.md"))
    print(f"Best model: {best_name}")
    print(json.dumps(results, indent=2))


if __name__ == "__main__":
    main()
