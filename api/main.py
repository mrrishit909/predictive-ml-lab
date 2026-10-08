"""PREDICTIVE, churn prediction API.

Real scikit-learn model trained by ml/train.py. No mocked endpoints: every
response here is computed from the loaded model artifact, or (for /drift)
from a deterministic seeded synthetic generator explicitly labeled as such.
"""
from __future__ import annotations

import json
import logging
import os
import sys
import time
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from fastapi import Depends, FastAPI, Header, HTTPException
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

logger = logging.getLogger("predictive.api")

app = FastAPI(title="PREDICTIVE, Churn Prediction API", version=MODEL_VERSION)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_state: dict = {}


# ---------------------------------------------------------------------------
# Auth: X-API-Key required on POST /predict and /predict/batch only.
# ---------------------------------------------------------------------------
def _valid_api_keys() -> set[str]:
    # Falls back to the same placeholder docker-compose.yml documents
    # (API_KEYS: ${API_KEYS:-local-dev-placeholder-key}), so a plain local
    # `uvicorn api.main:app` run behaves identically to `docker compose up`
    # instead of silently 401-ing every request because this env var alone
    # wasn't exported. Set a real API_KEYS value to replace this default.
    raw = os.environ.get("API_KEYS", "local-dev-placeholder-key")
    return {k.strip() for k in raw.split(",") if k.strip()}


# ---------------------------------------------------------------------------
# Rate limiting: fixed-window counter, keyed by API key (not IP, since every
# guarded request already carries one). Backend-agnostic: `client` just needs
# redis-compatible .incr(key)/.expire(key, seconds). client=None (REDIS_URL
# unset or unreachable) makes check() a literal no-op, never a fake pass that
# hides a bug - there is simply no limiter to enforce.
# ponytail: single shared window per key, no sliding window; good enough for
# a local demo. Upgrade to a sliding-window log if burst-at-boundary matters.
# ---------------------------------------------------------------------------
class RateLimiter:
    def __init__(self, client=None, limit: int = 60, window: int = 60):
        self.client = client
        self.limit = limit
        self.window = window

    def check(self, identity: str) -> bool:
        """Returns False if `identity` is over the limit. Always True (no-op)
        when no backend is configured."""
        if self.client is None:
            return True
        window_id = int(time.time() // self.window)
        key = f"ratelimit:{identity}:{window_id}"
        try:
            count = self.client.incr(key)
            if count == 1:
                self.client.expire(key, self.window)
            return count <= self.limit
        except Exception as exc:  # redis down mid-run: fail open, log it
            logger.warning("Rate limiter backend error, allowing request: %s", exc)
            return True


def _build_rate_limiter() -> RateLimiter:
    redis_url = os.environ.get("REDIS_URL")
    if not redis_url:
        return RateLimiter(client=None)
    try:
        import redis as redis_lib

        client = redis_lib.Redis.from_url(redis_url, socket_connect_timeout=2)
        client.ping()
        return RateLimiter(client=client)
    except Exception as exc:
        logger.warning("Rate limiting disabled: could not connect to REDIS_URL (%s)", exc)
        return RateLimiter(client=None)


def predict_guard(x_api_key: str | None = Header(default=None, alias="X-API-Key")) -> str:
    """Dependency for POST /predict and /predict/batch: auth then rate limit."""
    if not x_api_key or x_api_key not in _valid_api_keys():
        raise HTTPException(
            status_code=401,
            detail={"error": "unauthorized", "message": "Missing or invalid X-API-Key header"},
        )
    limiter: RateLimiter = _state.get("rate_limiter") or RateLimiter(client=None)
    if not limiter.check(x_api_key):
        raise HTTPException(
            status_code=429,
            detail={
                "error": "rate_limited",
                "message": f"Rate limit exceeded: max {limiter.limit} requests per {limiter.window}s",
            },
        )
    return x_api_key


# ---------------------------------------------------------------------------
# Postgres prediction logging: best-effort, never blocks or crashes a
# response. Table is created by db/init.sql, mounted into the postgres
# container's docker-entrypoint-initdb.d (see docker-compose.yml); this app
# never runs DDL itself.
# ---------------------------------------------------------------------------
def _connect_db():
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        logger.warning("DATABASE_URL not set: prediction logging disabled")
        return None
    try:
        import psycopg2

        conn = psycopg2.connect(database_url, connect_timeout=3)
        conn.autocommit = True
        return conn
    except Exception as exc:
        logger.warning("Prediction logging disabled: could not connect to DATABASE_URL (%s)", exc)
        return None


def _log_prediction(request_json: dict, proba: float, prediction: str, model_name: str, model_version: str) -> None:
    conn = _state.get("db_conn")
    if conn is None:
        return
    try:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO predictions "
                "(request_json, churn_probability, churn_prediction, model_name, model_version) "
                "VALUES (%s, %s, %s, %s, %s)",
                (json.dumps(request_json), proba, prediction, model_name, model_version),
            )
    except Exception as exc:  # DB hiccup mid-run: log and move on, never fail the request
        logger.warning("Prediction logging failed for this request: %s", exc)


@app.on_event("startup")
def load_artifacts() -> None:
    bundle = joblib.load(ARTIFACTS / "model.joblib")
    _state["model"] = bundle["model"]
    _state["model_name"] = bundle["model_name"]
    _state["baselines"] = bundle["baselines"]
    _state["threshold"] = bundle.get("threshold", 0.5)
    _state["metrics"] = json.loads((ARTIFACTS / "metrics.json").read_text())
    _state["shap_summary"] = json.loads((ARTIFACTS / "shap_summary.json").read_text())
    _state["db_conn"] = _connect_db()
    _state["rate_limiter"] = _build_rate_limiter()


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
def predict(customer: CustomerFeatures, _api_key: str = Depends(predict_guard)):
    df = _to_frame([customer])
    proba = float(_state["model"].predict_proba(df)[0, 1])
    threshold = _state.get("threshold", 0.5)
    prediction = "Yes" if proba >= threshold else "No"
    _log_prediction(customer.model_dump(), proba, prediction, _state["model_name"], MODEL_VERSION)
    return PredictionResponse(
        churn_probability=proba,
        churn_prediction=prediction,
        model_name=_state["model_name"],
        model_version=MODEL_VERSION,
    )


@app.post("/predict/batch", response_model=BatchPredictResponse)
def predict_batch(req: BatchPredictRequest, _api_key: str = Depends(predict_guard)):
    df = _to_frame(req.customers)
    probs = _state["model"].predict_proba(df)[:, 1]
    threshold = _state.get("threshold", 0.5)
    items = []
    for i, (p, customer) in enumerate(zip(probs, req.customers)):
        prediction = "Yes" if p >= threshold else "No"
        _log_prediction(customer.model_dump(), float(p), prediction, _state["model_name"], MODEL_VERSION)
        items.append(
            BatchPredictionItem(
                index=i,
                churn_probability=float(p),
                churn_prediction=prediction,
                model_name=_state["model_name"],
                model_version=MODEL_VERSION,
            )
        )
    return BatchPredictResponse(predictions=items)


@app.get("/explain/global", response_model=list[dict])
def explain_global():
    return _state["shap_summary"]


@app.post("/explain/local", response_model=ExplanationResponse)
def explain_local(customer: CustomerFeatures):
    """Local explanation: for each feature, replace it with its real TRAINING
    baseline (mean for numeric, mode for categorical - persisted by
    ml/train.py, not derived from this single request row) and measure the
    resulting probability delta. This is an approximation of SHAP's per-feature
    attribution (one feature perturbed at a time, not the full Shapley game),
    chosen to keep inference latency low; exact SHAP values from training are
    served by /explain/global."""
    df = _to_frame([customer])
    base_proba = float(_state["model"].predict_proba(df)[0, 1])
    baselines = _state["baselines"]
    impacts = []
    for col in ALL_FEATURES:
        perturbed = df.copy()
        perturbed[col] = baselines[col]
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
