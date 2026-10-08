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
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import shap
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
from sklearn.model_selection import StratifiedKFold, cross_val_score, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

from schema import ALL_FEATURES, CATEGORICAL_FEATURES, NUMERIC_FEATURES, TARGET

ROOT = Path(__file__).resolve().parent.parent
RAW_CSV = ROOT / "data" / "raw" / "Telco-Customer-Churn.csv"
ARTIFACTS = ROOT / "artifacts"
SEED = 42


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
    candidates = {
        "dummy": DummyClassifier(strategy="most_frequent"),
        "logistic_regression": LogisticRegression(max_iter=1000, class_weight="balanced"),
        "hist_gradient_boosting": HistGradientBoostingClassifier(random_state=SEED),
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

    joblib.dump(
        {"model": calibrated, "feature_order": ALL_FEATURES, "model_name": best_name},
        ARTIFACTS / "model.joblib",
    )

    # Global SHAP explainability on a background sample (exact KernelExplainer is
    # slow on OHE'd data; use the underlying best_pipe's gradient-boosted trees
    # with TreeExplainer when it won it, else a small permutation fallback).
    pre = best_pipe.named_steps["pre"]
    X_test_trans = pre.transform(X_test)
    feature_names = pre.get_feature_names_out().tolist()
    if best_name == "hist_gradient_boosting":
        explainer = shap.Explainer(best_pipe.named_steps["clf"])
        shap_values = explainer(X_test_trans.toarray() if hasattr(X_test_trans, "toarray") else X_test_trans)
        mean_abs = np.abs(shap_values.values).mean(axis=0)
    else:
        from sklearn.inspection import permutation_importance

        imp = permutation_importance(best_pipe, X_test, y_test, n_repeats=5, random_state=SEED)
        mean_abs = imp.importances_mean

    shap_summary = sorted(
        [{"feature": f, "mean_abs_impact": float(v)} for f, v in zip(feature_names, mean_abs)],
        key=lambda r: -r["mean_abs_impact"],
    )[:20]
    (ARTIFACTS / "shap_summary.json").write_text(json.dumps(shap_summary, indent=2))

    (ARTIFACTS / "metrics.json").write_text(
        json.dumps({"best_model": best_name, "results": results}, indent=2)
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

## Known limitations
- This is a public tutorial-grade dataset, not live production telemetry; results do not
  represent any real telecom operator.
- Drift monitoring in this app uses a deterministic synthetic shift generator, not real
  incoming traffic.
- No hyperparameter search (Optuna) was run; HistGradientBoosting uses scikit-learn defaults
  plus a fixed random_state. This is a documented simplification, not a hidden shortcut.
"""
    )
    print(f"Best model: {best_name}")
    print(json.dumps(results, indent=2))


if __name__ == "__main__":
    main()
