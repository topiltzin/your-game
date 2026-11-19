// Queue access for the worker: claim the oldest queued model job and sweep jobs past their
// deadline. Both run as RPCs defined in supabase/migrations/0001_create_model_jobs.sql, through
// the service-role client. The claim sets status = processing, so the pipeline starts from there.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CreateModelJob } from "../workflows/create-model-core.js";
import { JOB_DEADLINE_MS } from "../server/lib/job-service.js";

interface ClaimRow {
  id: string | null;
  input_key: string | null;
  texture_resolution: number | null;
  requested_at: string | null;
}

/** Takes the oldest queued job for this worker, or returns null when the queue is empty. */
export async function claimNextJob(db: SupabaseClient, workerId: string): Promise<CreateModelJob | null> {
  const { data, error } = await db.rpc("claim_model_job", { p_worker_id: workerId });
  if (error) throw new Error(`claim model job failed: ${error.message}`);

  const row = (Array.isArray(data) ? data[0] : data) as ClaimRow | null | undefined;
  // An empty queue returns no row, or a row of nulls (PostgREST can return one for composite types).
  if (!row || !row.id || !row.input_key || !row.requested_at) return null;

  return {
    id: row.id,
    inputKey: row.input_key,
    textureResolution: row.texture_resolution === 512 ? 512 : 1024,
    deadlineAt: new Date(new Date(row.requested_at).getTime() + JOB_DEADLINE_MS),
  };
}

/** Marks queued or processing jobs past their 10-minute deadline as timed_out. Returns the count. */
export async function sweepStaleJobs(db: SupabaseClient): Promise<number> {
  const { data, error } = await db.rpc("fail_stale_model_jobs", {});
  if (error) throw new Error(`sweep stale model jobs failed: ${error.message}`);
  return typeof data === "number" ? data : 0;
}
