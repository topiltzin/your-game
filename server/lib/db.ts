// Supabase access for model_jobs (table in supabase/migrations/0001_create_model_jobs.sql). Implements
// JobRepository (job-service.ts) with the server-only secret key. Status writes are conditional
// (`status IN (...)`), so a late pipeline result cannot overwrite a cancelled or timed-out job.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { JobRecord, JobRepository, JobStatus } from "./job-service.js";

const ACTIVE_STATUSES: JobStatus[] = ["queued", "processing"];

export function createSupabase(): SupabaseClient {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_SECRET_KEY"];
  if (!url) throw new Error("SUPABASE_URL is not set");
  if (!key) throw new Error("SUPABASE_SECRET_KEY is not set");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export interface JobRow {
  id: string;
  access_token_hash: string;
  status: JobStatus;
  input_key: string;
  texture_resolution: number;
  model_key: string | null;
  failure_reason: string | null;
  requested_at: string;
  ip_hash: string;
}

export type JobRepositoryWithCount = JobRepository & {
  countSince(ipHash: string, since: Date): Promise<number>;
};

export function createJobRepository(db: SupabaseClient): JobRepositoryWithCount {
  return {
    async insert(job) {
      const { error } = await db.from("model_jobs").insert({
        id: job.id,
        access_token_hash: job.tokenHash,
        status: job.status,
        input_key: job.inputKey,
        texture_resolution: job.textureResolution,
        requested_at: job.requestedAt.toISOString(),
        updated_at: new Date().toISOString(),
        ip_hash: job.ipHash,
      });
      if (error) throw new Error(`insert model_jobs failed: ${error.message}`);
    },

    async get(id) {
      const { data, error } = await db.from("model_jobs").select("*").eq("id", id).maybeSingle();
      if (error) throw new Error(`get model_jobs failed: ${error.message}`);
      return data ? toRecord(data as JobRow) : null;
    },

    async update(id, from, patch) {
      const changes = {
        ...(patch.status != null && { status: patch.status }),
        ...(patch.modelKey != null && { model_key: patch.modelKey }),
        ...(patch.failureReason != null && { failure_reason: patch.failureReason }),
        updated_at: new Date().toISOString(),
      };
      const { data, error } = await db
        .from("model_jobs")
        .update(changes)
        .eq("id", id)
        .in("status", from)
        .select("id");
      if (error) throw new Error(`update model_jobs failed: ${error.message}`);
      return (data ?? []).length === 1;
    },

    async findActiveByInput(inputKey) {
      const { data, error } = await db
        .from("model_jobs")
        .select("*")
        .eq("input_key", inputKey)
        .in("status", ACTIVE_STATUSES)
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(`find model_jobs failed: ${error.message}`);
      return data ? toRecord(data as JobRow) : null;
    },

    async countSince(ipHash, since) {
      const { count, error } = await db
        .from("model_jobs")
        .select("id", { count: "exact", head: true })
        .eq("ip_hash", ipHash)
        .gte("requested_at", since.toISOString());
      if (error) throw new Error(`count model_jobs failed: ${error.message}`);
      return count ?? 0;
    },
  };
}

export function toRecord(row: JobRow): JobRecord {
  return {
    id: row.id,
    tokenHash: row.access_token_hash,
    status: row.status,
    inputKey: row.input_key,
    textureResolution: row.texture_resolution === 512 ? 512 : 1024,
    modelKey: row.model_key,
    failureReason: row.failure_reason,
    requestedAt: new Date(row.requested_at),
    ipHash: row.ip_hash,
  };
}
