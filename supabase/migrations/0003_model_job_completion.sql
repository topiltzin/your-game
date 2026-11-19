-- Completion and failure RPCs for the shared emi_crafting worker in its `sketch` profile
-- (worker/trellis_worker/profiles.py in emi_crafting). Same parameter names as the photo RPCs.
-- Apply once in the Supabase SQL editor for project lrhvutyuikgvwuzaduil, after 0002.

-- Stores the model key on success. Only a processing job can complete, so a cancelled or timed-out
-- job is never overwritten. Returns discard = true when nothing was updated (the worker then removes
-- the uploaded file). p_size is accepted for parity with the photo RPC and is not stored.
CREATE OR REPLACE FUNCTION public.complete_model_job(p_job_id uuid, p_path text, p_size bigint)
RETURNS TABLE (discard boolean, old_path text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.model_jobs
  SET status = 'ready', model_key = p_path, updated_at = now()
  WHERE id = p_job_id AND status = 'processing';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count = 0 THEN
    RETURN QUERY SELECT true, NULL::text;
  ELSE
    RETURN QUERY SELECT false, NULL::text;
  END IF;
END;
$$;

-- Records a failure. The worker's codes (emi_crafting errors.py) are mapped to the codes your-game
-- shows (server/lib/errors.ts): TIMEOUT becomes timed_out, the service codes become
-- SERVICE_UNAVAILABLE, and anything else becomes INTERNAL.
CREATE OR REPLACE FUNCTION public.fail_model_job(p_job_id uuid, p_code text, p_message text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text := 'failed';
  v_reason text;
BEGIN
  IF p_code = 'TIMEOUT' THEN
    v_status := 'timed_out';
    v_reason := 'TIMED_OUT';
  ELSIF p_code IN ('SERVICE_BUSY', 'SERVICE_QUOTA') THEN
    v_reason := 'SERVICE_UNAVAILABLE';
  ELSIF p_code = 'INVALID_IMAGE' THEN
    v_reason := 'IMAGE_INVALID';
  ELSIF p_code = 'RESULT_TOO_LARGE' THEN
    v_reason := 'RESULT_TOO_LARGE';
  ELSE
    v_reason := 'INTERNAL';
  END IF;

  UPDATE public.model_jobs
  SET status = v_status, failure_reason = v_reason, updated_at = now()
  WHERE id = p_job_id AND status IN ('queued', 'processing');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.complete_model_job(uuid, text, bigint) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fail_model_job(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_model_job(uuid, text, bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_model_job(uuid, text, text) TO service_role;
