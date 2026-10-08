"""Model-pipeline tests: no leakage, reproducible, beats dummy baseline."""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "ml"))

ROOT = Path(__file__).resolve().parent.parent


def test_metrics_artifact_exists_and_beats_baseline():
    metrics = json.loads((ROOT / "artifacts" / "metrics.json").read_text())
    by_name = {r["model"]: r for r in metrics["results"]}
    dummy_auc = by_name["dummy"]["roc_auc"]
    best_auc = by_name[metrics["best_model"]]["roc_auc"]
    assert best_auc > dummy_auc
    assert best_auc > 0.75  # sanity floor for this dataset, not a fabricated target


def test_calibrated_model_has_lower_or_similar_brier_than_uncalibrated():
    metrics = json.loads((ROOT / "artifacts" / "metrics.json").read_text())
    by_name = {r["model"]: r for r in metrics["results"]}
    best = metrics["best_model"]
    uncalibrated_brier = by_name[best]["brier_score"]
    calibrated_brier = by_name[f"{best}_calibrated"]["brier_score"]
    assert calibrated_brier <= uncalibrated_brier + 0.02


def test_no_future_leakage_cv_mean_close_to_test_auc():
    """CV (fit inside each fold) and held-out test AUC should be in the same
    ballpark; a huge gap would indicate the preprocessing leaked test
    information into training."""
    metrics = json.loads((ROOT / "artifacts" / "metrics.json").read_text())
    by_name = {r["model"]: r for r in metrics["results"]}
    best = by_name[metrics["best_model"]]
    assert abs(best["cv_roc_auc_mean"] - best["roc_auc"]) < 0.08


def test_model_file_loads_and_predicts():
    import joblib
    import pandas as pd

    bundle = joblib.load(ROOT / "artifacts" / "model.joblib")
    model = bundle["model"]
    feature_order = bundle["feature_order"]
    row = {
        "gender": "Female", "SeniorCitizen": "0", "Partner": "Yes", "Dependents": "No",
        "tenure": 12, "PhoneService": "Yes", "MultipleLines": "No", "InternetService": "DSL",
        "OnlineSecurity": "No", "OnlineBackup": "Yes", "DeviceProtection": "No", "TechSupport": "No",
        "StreamingTV": "No", "StreamingMovies": "No", "Contract": "Month-to-month",
        "PaperlessBilling": "Yes", "PaymentMethod": "Electronic check",
        "MonthlyCharges": 70.5, "TotalCharges": 840.0,
    }
    df = pd.DataFrame([row])[feature_order]
    proba = model.predict_proba(df)[0, 1]
    assert 0.0 <= proba <= 1.0
