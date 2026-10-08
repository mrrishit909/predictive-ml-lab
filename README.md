# PREDICTIVE, Telecom Churn Prediction Lab

An end-to-end machine learning application: real training, real evaluation, a real FastAPI
inference service, and a React prediction studio with explainability and a drift monitor.

Built as project 1 of a portfolio set adapted from an "audited Claude multi-agent" master-prompt
PDF. The prompt specified a full enterprise stack (Optuna, MLflow, PostgreSQL, Redis, Docker
Compose, OpenTelemetry, Sentry, CI, a 3-subagent build team). This build keeps every piece that
changes what the app actually does, and substitutes or skips infrastructure that exists to
operate the app at scale rather than to make it work. See [`LIMITATIONS.md`](LIMITATIONS.md) for
the exact list of what was substituted and why.

## What it does

- Trains and evaluates three real models (Dummy baseline, LogisticRegression, HistGradientBoosting)
  on the public [IBM Telco Customer Churn dataset](https://github.com/IBM/telco-customer-churn-on-icp4d)
  (7,043 customers).
- Picks the best non-dummy model by ROC-AUC, isotonic-calibrates it, and reports real held-out
  test metrics (ROC-AUC, PR-AUC, precision/recall/F1, Brier score, confusion matrix).
- Serves it through FastAPI with Pydantic-validated single and batch prediction endpoints.
- Explains predictions: exact global SHAP importances from training, plus a fast perturbation-based
  local explanation per prediction.
- Simulates population drift with a seeded synthetic generator (clearly labeled as synthetic,
  not live telemetry) and flags days where predicted churn rate shifts >15%.
- React/Vite/Tailwind frontend with a canvas-based decision-boundary intro animation
  (skip + reduced-motion supported) and four functional views: Prediction studio, Explainability,
  Model comparison, Drift monitor.

## Run it locally

Requires Python 3.12 (via `uv`) and Node 22+.

```bash
# 1. Python env + train the model (takes ~15s)
uv venv --python 3.12 venv
source venv/bin/activate
uv pip install -r requirements.txt
python data/download.py          # fetches the public CSV
cd ml && python train.py && cd .. # writes artifacts/*.joblib, *.json, *.md

# 2. Run tests
python -m pytest tests/ -v       # 25 tests: model reproducibility + API negative-input gate + auth/rate-limit

# 3. Start the API
uvicorn api.main:app --port 8000 --reload

# 4. In a second terminal: the frontend
cd web && npm install && npm run dev
# open http://localhost:5173 (proxies /api/* to localhost:8000)
```

## Run it with Docker Compose (local only, no cloud deploy)

One command brings up Postgres, Redis, the API, and the built web frontend:

```bash
cp .env.example .env   # edit API_KEYS to a real generated value first
docker compose up --build
# API:  http://localhost:8000  (curl http://localhost:8000/health)
# Web:  http://localhost:8080
docker compose ps       # check health status of each service
docker compose down     # stop and remove containers
```

`postgres` and `redis` each have a healthcheck; `api` waits for both to report healthy before
starting, and `web` waits for `api`. Postgres gets its `predictions` table from `db/init.sql`,
mounted into `/docker-entrypoint-initdb.d/` (runs once, on first init of an empty data volume).

## API

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | liveness + model-loaded check |
| GET | `/models/current` | active model name, version, full metrics |
| GET | `/metrics` | same metrics, standalone |
| POST | `/predict` | single customer -> churn probability (requires `X-API-Key`) |
| POST | `/predict/batch` | 1-500 customers -> list of predictions (requires `X-API-Key`) |
| GET | `/explain/global` | training-time SHAP global importances |
| POST | `/explain/local` | perturbation-based local explanation |
| GET | `/drift?days=N` | synthetic drift simulation over N days |

All POST bodies are Pydantic-validated: missing fields, out-of-range numbers, invalid enum
values, NaN/infinity, and oversized batches all return 422, not a crash or a silent wrong answer.

### Auth, rate limiting, and prediction logging

- **`X-API-Key`** is required on `POST /predict` and `/predict/batch` only. Valid keys come from
  the comma-separated `API_KEYS` env var; a missing or wrong key returns `401` with a JSON body
  (`{"detail": {"error": "unauthorized", ...}}`). GET endpoints stay open.
- **Rate limiting** is a fixed window of 60 requests/minute per API key, backed by Redis
  (`REDIS_URL`). Over the limit returns `429`. If `REDIS_URL` is unset or unreachable, this is a
  documented no-op - literally skipped, not faked - so plain `pytest` runs without Docker stay
  deterministic.
- **Prediction logging**: every successful `/predict`/`/predict/batch` call writes a row to the
  `predictions` table (`DATABASE_URL`, see `db/init.sql` for the schema) via `psycopg2`. If
  `DATABASE_URL` is unset or the DB is unreachable, the app logs a warning and keeps serving
  predictions normally - it never blocks or crashes a response over logging.
- The churn-prediction cutoff reads `threshold` from the trained model artifact
  (`artifacts/model.joblib`), falling back to `0.5` if that key isn't present.

## Repository layout

```
ml/            training pipeline (schema, train.py) + model_card.md
api/           FastAPI app + Pydantic schemas, auth, rate limiting, DB logging
web/           React + Vite + TypeScript + Tailwind frontend
tests/         pytest: model reproducibility, API contract, negative-input gate, auth/rate-limit
artifacts/     model.joblib, metrics.json, shap_summary.json, model_card.md (generated)
data/          download script; data/raw/ is gitignored (re-run download.py)
db/            init.sql - creates the `predictions` table on first Postgres container init
Dockerfile, web/Dockerfile, docker-compose.yml   local-only Docker packaging (see above)
.github/workflows/ci.yml   pytest + web build on push/PR
```

See [`ARCHITECTURE.md`](ARCHITECTURE.md) for the design, [`LIMITATIONS.md`](LIMITATIONS.md) for
what is simplified, and `artifacts/model_card.md` for the model's actual evaluated metrics.
