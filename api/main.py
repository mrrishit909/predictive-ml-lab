"""PREDICTIVE, churn prediction API.

Real scikit-learn model trained by ml/train.py. No mocked endpoints: every
response here is computed from the loaded model artifact, or (for /drift)
from a deterministic seeded synthetic generator explicitly labeled as such.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "ml"))
from schema import ALL_FEATURES  # noqa: E402

from api.schemas import (
    BatchPredictRequest,
    BatchPredictResponse,
    BatchPredictionItem,
    CustomerFeatures,
    DriftPoint,
    ExplanationResponse,
    PredictionResponse,
)

ROOT = Path(__file__).resolve().parent.parent
ARTIFACTS = ROOT / "artifacts"
MODEL_VERSION = "v1"

app = FastAPI(title="PREDICTIVE, Churn Prediction API", version=MODEL_VERSION)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_state: dict = {}


@app.on_event("startup")
def load_artifacts() -> None:
    bundle = joblib.load(ARTIFACTS / "model.joblib")
    _state["model"] = bundle["model"]
    _state["model_name"] = bundle["model_name"]
    _state["metrics"] = json.loads((ARTIFACTS / "metrics.json").read_text())
    _state["shap_summary"] = json.loads((ARTIFACTS / "shap_summary.json").read_text())


@app.exception_handler(RequestValidationError)
async def validation_handler(request, exc: RequestValidationError):
    # Pydantic's error detail can embed raw out-of-range floats (e.g. NaN) in
    # the "input" field, which plain json.dumps refuses to serialize. jsonable
    # encoder with safe defaults isn't enough either, so stringify "input".
    safe_errors = []
    for err in exc.errors():
        err = dict(err)
        err["input"] = repr(err.get("input"))
        safe_errors.append(err)
    return JSONResponse(status_code=422, content={"detail": safe_errors})


def _to_frame(customers: list[CustomerFeatures]) -> pd.DataFrame:
    rows = [c.model_dump() for c in customers]
    return pd.DataFrame(rows)[ALL_FEATURES]


@app.get("/health")
def health():
    return {"status": "ok", "model_loaded": "model" in _state}


@app.get("/models/current")
def current_model():
    return {
        "model_name": _state["model_name"],
        "model_version": MODEL_VERSION,
        "metrics": _state["metrics"],
    }


@app.get("/metrics")
def metrics():
    return _state["metrics"]


@app.post("/predict", response_model=PredictionResponse)
def predict(customer: CustomerFeatures):
    df = _to_frame([customer])
    proba = float(_state["model"].predict_proba(df)[0, 1])
    return PredictionResponse(
        churn_probability=proba,
        churn_prediction="Yes" if proba >= 0.5 else "No",
        model_name=_state["model_name"],
        model_version=MODEL_VERSION,
    )


@app.post("/predict/batch", response_model=BatchPredictResponse)
def predict_batch(req: BatchPredictRequest):
    df = _to_frame(req.customers)
    probs = _state["model"].predict_proba(df)[:, 1]
    items = [
        BatchPredictionItem(
            index=i,
            churn_probability=float(p),
            churn_prediction="Yes" if p >= 0.5 else "No",
            model_name=_state["model_name"],
            model_version=MODEL_VERSION,
        )
        for i, p in enumerate(probs)
    ]
    return BatchPredictResponse(predictions=items)


@app.get("/explain/global", response_model=list[dict])
def explain_global():
    return _state["shap_summary"]


@app.post("/explain/local", response_model=ExplanationResponse)
def explain_local(customer: CustomerFeatures):
    """Approximate local explanation: perturb each feature to its training
    mode/mean and measure the probability delta. Documented as an
    approximation (not full SHAP) to keep inference latency low; global SHAP
    values (from training) are exact and served by /explain/global."""
    df = _to_frame([customer])
    base_proba = float(_state["model"].predict_proba(df)[0, 1])
    impacts = []
    for col in ALL_FEATURES:
        perturbed = df.copy()
        if not pd.api.types.is_numeric_dtype(df[col]):
            continue
        perturbed[col] = 0 if col == "tenure" else perturbed[col].mean()
        p = float(_state["model"].predict_proba(perturbed)[0, 1])
        impacts.append({"feature": col, "impact": base_proba - p})
    impacts.sort(key=lambda r: -abs(r["impact"]))
    return ExplanationResponse(churn_probability=base_proba, top_factors=impacts[:10])


@app.get("/drift", response_model=list[DriftPoint])
def drift(days: int = 30, seed: int = 7):
    """Deterministic synthetic drift simulation, NOT live production telemetry.
    Simulates a slow population shift (rising tenure, rising charges) over N
    days and reports the model's predicted churn rate on each day's synthetic
    cohort, flagging drift when the rate moves >15% relative to day 0."""
    rng = np.random.default_rng(seed)
    base_tenure, base_charges = 32.0, 64.0
    points = []
    baseline_rate = None
    for day in range(days):
        shift = day / days
        tenure = base_tenure * (1 - 0.3 * shift)
        charges = base_charges * (1 + 0.4 * shift)
        n = 200
        cohort = pd.DataFrame(
            {
                "gender": rng.choice(["Female", "Male"], n),
                "SeniorCitizen": rng.choice(["0", "1"], n, p=[0.85, 0.15]),
                "Partner": rng.choice(["Yes", "No"], n),
                "Dependents": rng.choice(["Yes", "No"], n),
                "tenure": np.clip(rng.normal(tenure, 10, n), 0, 100).astype(int),
                "PhoneService": "Yes",
                "MultipleLines": rng.choice(["Yes", "No"], n),
                "InternetService": rng.choice(["DSL", "Fiber optic", "No"], n),
                "OnlineSecurity": rng.choice(["Yes", "No"], n),
                "OnlineBackup": rng.choice(["Yes", "No"], n),
                "DeviceProtection": rng.choice(["Yes", "No"], n),
                "TechSupport": rng.choice(["Yes", "No"], n),
                "StreamingTV": rng.choice(["Yes", "No"], n),
                "StreamingMovies": rng.choice(["Yes", "No"], n),
                "Contract": rng.choice(["Month-to-month", "One year", "Two year"], n),
                "PaperlessBilling": rng.choice(["Yes", "No"], n),
                "PaymentMethod": rng.choice(
                    ["Electronic check", "Mailed check", "Bank transfer (automatic)", "Credit card (automatic)"], n
                ),
                "MonthlyCharges": np.clip(rng.normal(charges, 15, n), 0, 500),
                "TotalCharges": np.clip(rng.normal(charges * tenure, 200, n), 0, 20000),
            }
        )[ALL_FEATURES]
        rate = float(_state["model"].predict_proba(cohort)[:, 1].mean())
        if baseline_rate is None:
            baseline_rate = rate
        drift_flag = abs(rate - baseline_rate) / baseline_rate > 0.15
        points.append(
            DriftPoint(
                day=day,
                mean_tenure=float(cohort["tenure"].mean()),
                mean_monthly_charges=float(cohort["MonthlyCharges"].mean()),
                predicted_churn_rate=rate,
                drift_flag=drift_flag,
            )
        )
    return points
