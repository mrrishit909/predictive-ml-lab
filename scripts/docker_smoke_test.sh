#!/usr/bin/env bash
# Non-interactive, re-runnable Docker Compose smoke test for PREDICTIVE.
# Proves a fresh-checkout `docker compose up` actually works end to end:
# build -> health -> auth gate -> a real /predict call -> Postgres logging.
# Exits non-zero on the first failure. Run from anywhere; it cd's to the repo.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

API_KEY="local-dev-placeholder-key"
PG_USER="predictive"
PG_DB="predictive"
EVIDENCE_DIR="$REPO_ROOT/artifacts/verification"
mkdir -p "$EVIDENCE_DIR"

GOOD_CUSTOMER='{"gender":"Female","SeniorCitizen":"0","Partner":"Yes","Dependents":"No","tenure":12,"PhoneService":"Yes","MultipleLines":"No","InternetService":"DSL","OnlineSecurity":"No","OnlineBackup":"Yes","DeviceProtection":"No","TechSupport":"No","StreamingTV":"No","StreamingMovies":"No","Contract":"Month-to-month","PaperlessBilling":"Yes","PaymentMethod":"Electronic check","MonthlyCharges":70.5,"TotalCharges":840.0}'

fail() { echo "SMOKE TEST FAILED: $1" >&2; docker compose logs --no-color > "$EVIDENCE_DIR/docker_smoke_failure_logs.txt" 2>&1 || true; exit 1; }

echo "== 1. wipe to prove fresh-checkout startup (down -v) =="
docker compose down -v || true

echo "== 2. build + start, wait for healthchecks =="
docker compose up -d --build --wait --wait-timeout 180 || fail "docker compose up --wait did not reach healthy"

echo "== 3. docker compose ps =="
docker compose ps

echo "== 4. GET /health =="
curl -sf localhost:8000/health || fail "/health did not return 200"
echo

echo "== 5. baseline prediction count in Postgres =="
BEFORE=$(docker compose exec -T postgres psql -U "$PG_USER" -d "$PG_DB" -tA -c "select count(*) from predictions;") || fail "could not query predictions table"
echo "predictions count before: $BEFORE"

echo "== 6. POST /predict WITH X-API-Key -> expect 200 =="
CODE=$(curl -s -o /tmp/predict_ok.json -w '%{http_code}' -X POST localhost:8000/predict \
  -H "Content-Type: application/json" -H "X-API-Key: $API_KEY" -d "$GOOD_CUSTOMER")
[ "$CODE" = "200" ] || fail "/predict with valid key returned $CODE, expected 200 (body: $(cat /tmp/predict_ok.json))"
cat /tmp/predict_ok.json

echo "== 7. POST /predict WITHOUT X-API-Key -> expect 401 =="
CODE=$(curl -s -o /tmp/predict_401.json -w '%{http_code}' -X POST localhost:8000/predict \
  -H "Content-Type: application/json" -d "$GOOD_CUSTOMER")
[ "$CODE" = "401" ] || fail "/predict without a key returned $CODE, expected 401 (body: $(cat /tmp/predict_401.json))"
cat /tmp/predict_401.json

echo "== 8. confirm the 200 call (and only that one) got logged in Postgres =="
AFTER=$(docker compose exec -T postgres psql -U "$PG_USER" -d "$PG_DB" -tA -c "select count(*) from predictions;") || fail "could not re-query predictions table"
echo "predictions count after: $AFTER"
[ "$((AFTER - BEFORE))" = "1" ] || fail "expected exactly 1 new row (the 200 call) in predictions, got $((AFTER - BEFORE)) (before=$BEFORE after=$AFTER)"

echo "== 9. Redis rate limit: 61 authenticated calls -> last one 429 =="
LAST_CODE=0
for i in $(seq 1 61); do
  LAST_CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST localhost:8000/predict \
    -H "Content-Type: application/json" -H "X-API-Key: $API_KEY" -d "$GOOD_CUSTOMER")
done
[ "$LAST_CODE" = "429" ] || fail "61st request in one minute returned $LAST_CODE, expected 429 (rate limiter not enforced)"

echo "ALL SMOKE TESTS PASSED"
