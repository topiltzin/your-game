-- model_jobs: one row per 3D job (data-model.md). Only hashes of tokens and IPs are stored.
CREATE TABLE IF NOT EXISTS model_jobs (
  id uuid PRIMARY KEY,
  access_token_hash text NOT NULL,
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'processing', 'ready', 'failed', 'timed_out', 'cancelled')),
  input_key text NOT NULL,
  texture_resolution smallint NOT NULL CHECK (texture_resolution IN (512, 1024)),
  model_key text,
  failure_reason text,
  requested_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  ip_hash text NOT NULL
);

CREATE INDEX IF NOT EXISTS model_jobs_status_requested_idx ON model_jobs (status, requested_at);
CREATE INDEX IF NOT EXISTS model_jobs_ip_requested_idx ON model_jobs (ip_hash, requested_at);
