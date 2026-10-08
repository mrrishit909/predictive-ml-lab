-- Mounted into the postgres container at /docker-entrypoint-initdb.d/init.sql
-- (see docker-compose.yml). Postgres only runs files in that directory on
-- first init of an empty data volume, so this is a one-time schema setup,
-- not a migration tool. The app (api/main.py) never runs DDL itself.
CREATE TABLE IF NOT EXISTS predictions (
    id BIGSERIAL PRIMARY KEY,
    request_json JSONB NOT NULL,
    churn_probability DOUBLE PRECISION NOT NULL,
    churn_prediction TEXT NOT NULL,
    model_name TEXT NOT NULL,
    model_version TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
