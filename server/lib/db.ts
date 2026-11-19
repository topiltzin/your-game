// Neon Postgres access for model_jobs. The SQL here implements JobRepository (job-service.ts).
// Status writes are conditional (WHERE status = ANY(...)), so a late workflow result cannot
// overwrite a cancelled or timed-out job.

import { neon } from "@neondatabase/serverless";
import type { JobRecord, JobRepository, JobStatus } from "./job-service";

type Sql = ReturnType<typeof neon>;

export function createSql(): Sql {
  const url = process.env["DATABASE_URL"];
  if (!url) throw new Error("DATABASE_URL is not set");
  return neon(url);
}

interface JobRow {
  id: string;
  access_token_hash: string;
  status: JobStatus;
  input_key: string;
  texture_resolution: number;
  model_key: string | null;
  failure_reason: string | null;
  requested_at: Date | string;
  ip_hash: string;
}

export type JobRepositoryWithCount = JobRepository & {
  countSince(ipHash: string, since: Date): Promise<number>;
};

export function createJobRepository(sql: Sql): JobRepositoryWithCount {
  return {
    async insert(job) {
      await sql`
        INSERT INTO model_jobs (id, access_token_hash, status, input_key, texture_resolution, requested_at, updated_at, ip_hash)
        VALUES (${job.id}::uuid, ${job.tokenHash}, ${job.status}, ${job.inputKey}, ${job.textureResolution},
                ${job.requestedAt.toISOString()}::timestamptz, now(), ${job.ipHash})`;
    },

    async get(id) {
      const rows = (await sql`SELECT * FROM model_jobs WHERE id = ${id}::uuid`) as JobRow[];
      const row = rows[0];
      return row ? toRecord(row) : null;
    },

    async update(id, from, patch) {
      const rows = (await sql`
        UPDATE model_jobs
        SET status = COALESCE(${patch.status ?? null}, status),
            model_key = COALESCE(${patch.modelKey ?? null}, model_key),
            failure_reason = COALESCE(${patch.failureReason ?? null}, failure_reason),
            updated_at = now()
        WHERE id = ${id}::uuid AND status = ANY(${from}::text[])
        RETURNING id`) as { id: string }[];
      return rows.length === 1;
    },

    async findActiveByInput(inputKey) {
      const rows = (await sql`
        SELECT * FROM model_jobs
        WHERE input_key = ${inputKey} AND status IN ('queued', 'processing')
        LIMIT 1`) as JobRow[];
      const row = rows[0];
      return row ? toRecord(row) : null;
    },

    async countSince(ipHash, since) {
      const rows = (await sql`
        SELECT count(*)::int AS n FROM model_jobs
        WHERE ip_hash = ${ipHash} AND requested_at >= ${since.toISOString()}::timestamptz`) as { n: number }[];
      return rows[0]?.n ?? 0;
    },
  };
}

function toRecord(row: JobRow): JobRecord {
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
