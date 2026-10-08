"""API tests: real request/response contract, including the negative-input gate."""
import os
import sys
from pathlib import Path

# Must be set before `api.main` is imported: it reads API_KEYS from the
# environment at request time via os.environ.get, but the test client needs
# a known key to send. DATABASE_URL and REDIS_URL are intentionally left
# unset here - this file proves the degraded "no DB / no rate limiter"
# path works without Docker, which is how a plain `pytest` run operates.
TEST_API_KEY = "pytest-only-test-key-not-a-secret"
os.environ["API_KEYS"] = TEST_API_KEY
AUTH_HEADERS = {"X-API-Key": TEST_API_KEY}

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from api.main import app, RateLimiter

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
    r = client.post("/predict", json=GOOD_CUSTOMER, headers=AUTH_HEADERS)
    assert r.status_code == 200
    body = r.json()
    assert 0.0 <= body["churn_probability"] <= 1.0
    assert body["churn_prediction"] in ("Yes", "No")


def test_predict_missing_api_key_rejected(client):
    r = client.post("/predict", json=GOOD_CUSTOMER)
    assert r.status_code == 401


def test_predict_wrong_api_key_rejected(client):
    r = client.post("/predict", json=GOOD_CUSTOMER, headers={"X-API-Key": "wrong-key"})
    assert r.status_code == 401


def test_predict_negative_tenure_rejected(client):
    bad = dict(GOOD_CUSTOMER, tenure=-5)
    assert client.post("/predict", json=bad, headers=AUTH_HEADERS).status_code == 422


def test_predict_missing_field_rejected(client):
    bad = dict(GOOD_CUSTOMER)
    del bad["Contract"]
    assert client.post("/predict", json=bad, headers=AUTH_HEADERS).status_code == 422


def test_predict_invalid_enum_rejected(client):
    bad = dict(GOOD_CUSTOMER, Contract="Lifetime")
    assert client.post("/predict", json=bad, headers=AUTH_HEADERS).status_code == 422


def test_predict_nan_rejected(client):
    # True JSON has no NaN literal; Python's json module emits a non-standard
    # bare `NaN` token that some parsers accept, so send raw bytes to exercise
    # that path instead of relying on a client-side encoder (which refuses to
    # serialize float("nan") at all).
    import json as _json

    bad = dict(GOOD_CUSTOMER, MonthlyCharges=float("nan"))
    body = _json.dumps(bad).encode()
    headers = dict(AUTH_HEADERS, **{"content-type": "application/json"})
    r = client.post("/predict", content=body, headers=headers)
    assert r.status_code == 422


def test_predict_out_of_range_rejected(client):
    bad = dict(GOOD_CUSTOMER, MonthlyCharges=-10)
    assert client.post("/predict", json=bad, headers=AUTH_HEADERS).status_code == 422


def test_predict_malformed_json_rejected(client):
    headers = dict(AUTH_HEADERS, **{"content-type": "application/json"})
    r = client.post("/predict", content=b"{not json", headers=headers)
    assert r.status_code == 422


def test_batch_predict(client):
    r = client.post(
        "/predict/batch", json={"customers": [GOOD_CUSTOMER, GOOD_CUSTOMER]}, headers=AUTH_HEADERS
    )
    assert r.status_code == 200
    assert len(r.json()["predictions"]) == 2


def test_batch_predict_missing_api_key_rejected(client):
    r = client.post("/predict/batch", json={"customers": [GOOD_CUSTOMER]})
    assert r.status_code == 401


def test_batch_predict_oversized_rejected(client):
    r = client.post("/predict/batch", json={"customers": [GOOD_CUSTOMER] * 501}, headers=AUTH_HEADERS)
    assert r.status_code == 422


def test_batch_predict_empty_rejected(client):
    r = client.post("/predict/batch", json={"customers": []}, headers=AUTH_HEADERS)
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


def test_predict_works_without_database_url(client):
    # DATABASE_URL is unset for this whole test module (see top of file); the
    # app must still start (the `client` fixture already proves startup) and
    # /predict must still return 200 in this degraded "no logging" mode.
    assert "DATABASE_URL" not in os.environ
    r = client.post("/predict", json=GOOD_CUSTOMER, headers=AUTH_HEADERS)
    assert r.status_code == 200


class _FakeRedisClient:
    """In-memory stand-in for a redis client: same incr/expire surface, no
    network. Used to test RateLimiter's real counting logic deterministically."""

    def __init__(self):
        self.counts: dict[str, int] = {}

    def incr(self, key):
        self.counts[key] = self.counts.get(key, 0) + 1
        return self.counts[key]

    def expire(self, key, seconds):
        pass


def test_rate_limiter_allows_up_to_limit_then_blocks():
    limiter = RateLimiter(client=_FakeRedisClient(), limit=60, window=60)
    results = [limiter.check("same-key") for _ in range(75)]
    assert results[:60] == [True] * 60
    assert results[60:] == [False] * 15


def test_rate_limiter_is_noop_without_backend():
    limiter = RateLimiter(client=None, limit=1, window=60)
    # No backend configured -> literal skip, never blocks regardless of count.
    assert all(limiter.check("same-key") for _ in range(10))


def test_rate_limiter_tracks_identities_independently():
    limiter = RateLimiter(client=_FakeRedisClient(), limit=2, window=60)
    assert limiter.check("a") is True
    assert limiter.check("a") is True
    assert limiter.check("a") is False
    assert limiter.check("b") is True
