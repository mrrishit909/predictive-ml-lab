"""Export everything the static site (site/) needs to run genuine browser-native
inference against the EXACT shipped model, no approximation:

  site/public/data/model/fold_{0..4}.onnx       - each CV fold's pipeline (ColumnTransformer
                                                   + tuned HistGradientBoostingClassifier),
                                                   predict_proba output only
  site/public/data/model/calibrators.json       - each fold's isotonic calibrator as
                                                   piecewise-linear breakpoints, plus the
                                                   shipped decision threshold
  site/public/data/model/metadata.json          - feature order, category values, model info
  site/public/data/customers.sample.json        - real held-out test-split rows
  site/public/data/model.predictions.json       - real predicted probabilities for those
                                                   rows (closes PRD-050: independently
                                                   recomputable from a persisted log)
  site/public/data/model.metrics.json           - copy of artifacts/metrics.json
  site/public/data/feature.explanations.json    - real training-time SHAP (HGB log-odds
                                                   space - labeled as such, NOT the
                                                   calibrated ensemble's probability output)
  site/public/data/model.metadata.json          - headline model info for the site

The browser replicates CalibratedClassifierCV(method="isotonic") exactly:
  for each of 5 folds:
    p = onnx_fold[i].predict_proba(row)[1]
    score = ln(p / (1 - p))                          # logit - HGB's decision_function
    calibrated_i = isotonic_interp(clip(score, Xmin_i, Xmax_i), breakpoints_i)
  final_probability = mean(calibrated_i for i in 0..4)
This was verified byte-for-byte (within 1e-6) against sklearn's own
CalibratedClassifierCV.predict_proba before this script was written - see
tests/test_onnx_parity.py, which re-verifies it on every real test-split row.
"""
from __future__ import annotations

import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import shap
from skl2onnx import to_onnx
from skl2onnx.common.data_types import FloatTensorType, StringTensorType

from schema import ALL_FEATURES, CATEGORICAL_FEATURES, CATEGORY_VALUES, NUMERIC_FEATURES, TARGET
from train import load_data

ROOT = Path(__file__).resolve().parent.parent
ARTIFACTS = ROOT / "artifacts"
SITE_DATA = ROOT / "site" / "public" / "data"
SITE_MODEL = SITE_DATA / "model"
SEED = 42


def _onnx_input_types() -> list[tuple[str, object]]:
    types = []
    for col in ALL_FEATURES:
        if col in NUMERIC_FEATURES:
            types.append((col, FloatTensorType([None, 1])))
        else:
            types.append((col, StringTensorType([None, 1])))
    return types


def export_onnx_folds(model) -> list[dict]:
    SITE_MODEL.mkdir(parents=True, exist_ok=True)
    calibrators_out = []
    initial_types = _onnx_input_types()
    for i, cc in enumerate(model.calibrated_classifiers_):
        # zipmap=False: without it, skl2onnx wraps the classifier's
        # probability output in a ZipMap (seq<map<int64,float>>) rather than a
        # plain tensor, which onnxruntime-node (and some onnxruntime-web
        # backends) reject with "Non tensor type is temporarily not
        # supported". A plain [N,2] float tensor is what churnModel.ts expects.
        onx = to_onnx(
            cc.estimator, initial_types=initial_types, target_opset=18,
            options={id(cc.estimator): {"zipmap": False}},
        )
        path = SITE_MODEL / f"fold_{i}.onnx"
        path.write_bytes(onx.SerializeToString())

        cal = cc.calibrators[0]
        calibrators_out.append(
            {
                "fold": i,
                "x_min": float(cal.X_min_),
                "x_max": float(cal.X_max_),
                "x": [float(v) for v in cal.f_.x],
                "y": [float(v) for v in cal.f_.y],
            }
        )
        print(f"  fold_{i}.onnx: {path.stat().st_size} bytes")
    return calibrators_out


def main() -> None:
    SITE_DATA.mkdir(parents=True, exist_ok=True)
    bundle = joblib.load(ARTIFACTS / "model.joblib")
    model = bundle["model"]
    threshold = bundle.get("threshold", 0.5)
    model_name = bundle["model_name"]

    print("Exporting ONNX folds (exact CalibratedClassifierCV replication)...")
    calibrators = export_onnx_folds(model)
    (SITE_MODEL / "calibrators.json").write_text(
        json.dumps({"threshold": threshold, "calibrators": calibrators}, indent=2)
    )

    (SITE_MODEL / "metadata.json").write_text(
        json.dumps(
            {
                "model_name": model_name,
                "feature_order": ALL_FEATURES,
                "numeric_features": NUMERIC_FEATURES,
                "categorical_features": CATEGORICAL_FEATURES,
                "category_values": CATEGORY_VALUES,
                "threshold": threshold,
                "n_folds": len(calibrators),
                "inference": "onnxruntime-web, exact CalibratedClassifierCV(isotonic) replication, not an approximation",
            },
            indent=2,
        )
    )

    # Real held-out test-split rows + real predictions, for the Decision Space /
    # Prediction Laboratory to draw from and for PRD-050 (recompute displayed
    # metrics from a persisted prediction log, not re-derived from the same run).
    df = load_data()
    from sklearn.model_selection import train_test_split

    X = df[ALL_FEATURES]
    y = df[TARGET]
    _, X_test, _, y_test = train_test_split(X, y, test_size=0.2, stratify=y, random_state=SEED)

    proba = model.predict_proba(X_test)[:, 1]
    preds = (proba >= threshold).astype(int)

    N_SAMPLE = 400
    rng = np.random.default_rng(SEED)
    sample_idx = rng.choice(len(X_test), size=min(N_SAMPLE, len(X_test)), replace=False)

    customers_sample = []
    predictions_out = []
    for j, idx in enumerate(sample_idx):
        row = X_test.iloc[idx].to_dict()
        customers_sample.append({"id": int(j), **row, "actual_churn": int(y_test.iloc[idx])})
        predictions_out.append(
            {
                "id": int(j),
                "churn_probability": float(proba[idx]),
                "churn_prediction": "Yes" if preds[idx] else "No",
                "actual_churn": int(y_test.iloc[idx]),
            }
        )
    (SITE_DATA / "customers.sample.json").write_text(json.dumps(customers_sample, indent=2))
    (SITE_DATA / "model.predictions.json").write_text(json.dumps(predictions_out, indent=2))

    metrics = json.loads((ARTIFACTS / "metrics.json").read_text())
    (SITE_DATA / "model.metrics.json").write_text(json.dumps(metrics, indent=2))

    # Real training-time SHAP, explicitly labeled: computed on the WINNING
    # HistGradientBoostingClassifier in its own log-odds output space, which is
    # NOT the same scale as the calibrated ensemble probability the UI shows.
    best_pipe = model.calibrated_classifiers_[0].estimator
    pre = best_pipe.named_steps["pre"]
    X_test_trans = pre.transform(X_test)
    if hasattr(X_test_trans, "toarray"):
        X_test_trans = X_test_trans.toarray()
    feature_names = pre.get_feature_names_out().tolist()
    explainer = shap.TreeExplainer(best_pipe.named_steps["clf"])
    shap_values = explainer(X_test_trans[sample_idx])
    mean_abs = np.abs(shap_values.values).mean(axis=0)
    global_explanations = sorted(
        [{"feature": f, "mean_abs_impact": float(v)} for f, v in zip(feature_names, mean_abs)],
        key=lambda r: -r["mean_abs_impact"],
    )
    per_row = []
    for k, idx in enumerate(sample_idx):
        row_shap = shap_values.values[k]
        top = sorted(
            zip(feature_names, row_shap.tolist()), key=lambda t: -abs(t[1])
        )[:8]
        per_row.append({"id": int(k), "top_factors": [{"feature": f, "shap_value": v} for f, v in top]})
    (SITE_DATA / "feature.explanations.json").write_text(
        json.dumps(
            {
                "space": "log-odds of the HistGradientBoostingClassifier base model, NOT the calibrated ensemble probability shown elsewhere in the UI",
                "global": global_explanations[:20],
                "per_row": per_row,
            },
            indent=2,
        )
    )

    print(f"\nExported fixtures for {len(customers_sample)} real test-split customers to {SITE_DATA}")


if __name__ == "__main__":
    main()
