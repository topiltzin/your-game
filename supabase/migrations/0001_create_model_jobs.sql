-- model_jobs: one row per 3D job, in the shared Supabase project (same project as emi_crafting,
-- which uses model_conversions). Only hashes of tokens and IPs are stored.
-- Apply once in the Supabase SQL editor for project lrhvutyuikgvwuzaduil, or with `supabase db push`.

CREATE TABLE IF NOT EXISTS public.model_jobs (
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
  started_at timestamptz,
  worker_id text,
  ip_hash text NOT NULL
);

CREATE INDEX IF NOT EXISTS model_jobs_status_requested_idx ON public.model_jobs (status, requested_at);
CREATE INDEX IF NOT EXISTS model_jobs_ip_requested_idx ON public.model_jobs (ip_hash, requested_at);
CREATE INDEX IF NOT EXISTS model_jobs_input_active_idx ON public.model_jobs (input_key) WHERE status IN ('queued', 'processing');

-- Only the server (service role) reads or writes this table. RLS on with no policies means the
-- publishable/anon key can't read token or IP hashes through the REST API.
ALTER TABLE public.model_jobs ENABLE ROW LEVEL SECURITY;

-- Worker claim: the oldest queued job, locked so two workers never take the same row.
CREATE OR REPLACE FUNCTION public.claim_model_job(p_worker_id text)
RETURNS public.model_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job public.model_jobs;
BEGIN
  UPDATE public.model_jobs
  SET status = 'processing', started_at = now(), worker_id = p_worker_id, updated_at = now()
  WHERE id = (
    SELECT id FROM public.model_jobs
    WHERE status = 'queued'
    ORDER BY requested_at
    FOR UPDATE SKIP LOCKED
    LIMIT 1
  )
  RETURNING * INTO v_job;

  RETURN v_job;
END;
$$;

-- Jobs stuck in queued/processing past the 10-minute deadline become timed_out.
CREATE OR REPLACE FUNCTION public.fail_stale_model_jobs()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.model_jobs
  SET status = 'timed_out', failure_reason = 'TIMED_OUT', updated_at = now()
  WHERE status IN ('queued', 'processing')
    AND requested_at < now() - interval '10 minutes';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.claim_model_job(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fail_stale_model_jobs() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_model_job(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_stale_model_jobs() TO service_role;
