"""API tests: real request/response contract, including the negative-input gate."""
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from api.main import app

GOOD_CUSTOMER = {
    "gender": "Female", "SeniorCitizen": "0", "Partner": "Yes", "Dependents": "No",
    "tenure": 12, "PhoneService": "Yes", "MultipleLines": "No", "InternetService": "DSL",
    "OnlineSecurity": "No", "OnlineBackup": "Yes", "DeviceProtection": "No", "TechSupport": "No",
    "StreamingTV": "No", "StreamingMovies": "No", "Contract": "Month-to-month",
    "PaperlessBilling": "Yes", "PaymentMethod": "Electronic check",
    "MonthlyCharges": 70.5, "TotalCharges": 840.0,
}


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["model_loaded"] is True


def test_predict_valid(client):
    r = client.post("/predict", json=GOOD_CUSTOMER)
    assert r.status_code == 200
    body = r.json()
    assert 0.0 <= body["churn_probability"] <= 1.0
    assert body["churn_prediction"] in ("Yes", "No")


def test_predict_negative_tenure_rejected(client):
    bad = dict(GOOD_CUSTOMER, tenure=-5)
    assert client.post("/predict", json=bad).status_code == 422


def test_predict_missing_field_rejected(client):
    bad = dict(GOOD_CUSTOMER)
    del bad["Contract"]
    assert client.post("/predict", json=bad).status_code == 422


def test_predict_invalid_enum_rejected(client):
    bad = dict(GOOD_CUSTOMER, Contract="Lifetime")
    assert client.post("/predict", json=bad).status_code == 422


def test_predict_nan_rejected(client):
    # True JSON has no NaN literal; Python's json module emits a non-standard
    # bare `NaN` token that some parsers accept, so send raw bytes to exercise
    # that path instead of relying on a client-side encoder (which refuses to
    # serialize float("nan") at all).
    import json as _json

    bad = dict(GOOD_CUSTOMER, MonthlyCharges=float("nan"))
    body = _json.dumps(bad).encode()
    r = client.post("/predict", content=body, headers={"content-type": "application/json"})
    assert r.status_code == 422


def test_predict_out_of_range_rejected(client):
    bad = dict(GOOD_CUSTOMER, MonthlyCharges=-10)
    assert client.post("/predict", json=bad).status_code == 422


def test_predict_malformed_json_rejected(client):
    r = client.post("/predict", content=b"{not json", headers={"content-type": "application/json"})
    assert r.status_code == 422


def test_batch_predict(client):
    r = client.post("/predict/batch", json={"customers": [GOOD_CUSTOMER, GOOD_CUSTOMER]})
    assert r.status_code == 200
    assert len(r.json()["predictions"]) == 2


def test_batch_predict_oversized_rejected(client):
    r = client.post("/predict/batch", json={"customers": [GOOD_CUSTOMER] * 501})
    assert r.status_code == 422


def test_batch_predict_empty_rejected(client):
    r = client.post("/predict/batch", json={"customers": []})
    assert r.status_code == 422


def test_models_current(client):
    r = client.get("/models/current")
    assert r.status_code == 200
    assert "metrics" in r.json()


def test_explain_local(client):
    r = client.post("/explain/local", json=GOOD_CUSTOMER)
    assert r.status_code == 200
    assert len(r.json()["top_factors"]) > 0


def test_drift(client):
    r = client.get("/drift?days=5")
    assert r.status_code == 200
    assert len(r.json()) == 5
