// Job lifecycle rules for POST/GET/DELETE /api/jobs (contracts/api.md, data-model.md).
// Pure logic over injected dependencies: the database, clock, and external calls are passed in,
// so the rules are tested without a network or a database.

import type { ErrorCode } from "./errors.js";
import { ERROR_TABLE } from "./errors.js";
import type { RateLimiter } from "./rate-limit.js";
import { hashToken, verifyToken } from "./job-token.js";

export type JobStatus = "queued" | "processing" | "ready" | "failed" | "timed_out" | "cancelled";
const ACTIVE: JobStatus[] = ["queued", "processing"];
const TERMINAL_FAILURE: JobStatus[] = ["failed", "timed_out"];
export const JOB_DEADLINE_MS = 10 * 60 * 1000;
export const MODEL_URL_TTL_SECONDS = 15 * 60;

export interface JobRecord {
  readonly id: string;
  readonly tokenHash: string;
  readonly status: JobStatus;
  readonly inputKey: string;
  readonly textureResolution: 512 | 1024;
  readonly modelKey: string | null;
  readonly failureReason: string | null;
  readonly requestedAt: Date;
  readonly ipHash: string;
}

export interface JobRepository {
  insert(job: JobRecord): Promise<void>;
  get(id: string): Promise<JobRecord | null>;
  /** Conditional update: applies only when the current status is one of `from`. */
  update(id: string, from: JobStatus[], patch: Partial<Pick<JobRecord, "status" | "modelKey" | "failureReason">>): Promise<boolean>;
  findActiveByInput(inputKey: string): Promise<JobRecord | null>;
}

export interface JobServiceDeps {
  readonly repo: JobRepository;
  readonly rateLimiter: RateLimiter;
  readonly startWorkflow: (jobId: string) => Promise<void>;
  readonly now: () => Date;
  readonly newId: () => string;
  readonly newToken: () => string;
  readonly ipHash: () => string;
  readonly signModelUrl: (modelKey: string, ttlSeconds: number) => string;
}

export interface CreateJobInput {
  readonly inputKey: string;
  readonly textureResolution: 512 | 1024;
  readonly disclosureAccepted: boolean;
}

export interface PublicJob {
  readonly id: string;
  readonly status: JobStatus;
  readonly requestedAt: string;
  readonly deadlineAt: string;
}

export type ServiceResult<T> = { ok: true } & T | { ok: false; code: ErrorCode };

export interface JobStatusView {
  readonly id: string;
  readonly status: JobStatus;
  readonly requestedAt: string;
  readonly deadlineAt: string;
  readonly modelUrl: string | null;
  readonly failure: { code: ErrorCode; message: string; retryable: boolean } | null;
}

export interface JobService {
  createJob(input: CreateJobInput): Promise<ServiceResult<{ job: PublicJob; accessToken: string }>>;
  getJob(id: string, token: string): Promise<ServiceResult<{ data: JobStatusView }>>;
  cancelJob(id: string, token: string): Promise<ServiceResult<{ data: { id: string; status: JobStatus } }>>;
}

export function createJobService(deps: JobServiceDeps): JobService {
  return {
    async createJob(input) {
      if (!input.disclosureAccepted) return { ok: false, code: "DISCLOSURE_REQUIRED" };
      if (input.textureResolution !== 512 && input.textureResolution !== 1024) {
        return { ok: false, code: "VALIDATION" };
      }
      const now = deps.now();
      const ipHash = deps.ipHash();
      if (!(await deps.rateLimiter.check(ipHash, now))) return { ok: false, code: "RATE_LIMITED" };
      if (await deps.repo.findActiveByInput(input.inputKey)) return { ok: false, code: "JOB_ALREADY_ACTIVE" };

      const token = deps.newToken();
      const record: JobRecord = {
        id: deps.newId(),
        tokenHash: hashToken(token),
        status: "queued",
        inputKey: input.inputKey,
        textureResolution: input.textureResolution,
        modelKey: null,
        failureReason: null,
        requestedAt: now,
        ipHash,
      };
      await deps.repo.insert(record);
      await deps.startWorkflow(record.id);
      return { ok: true, job: toPublic(record), accessToken: token };
    },

    async getJob(id, token) {
      const found = await loadOwned(deps, id, token);
      if (!found) return { ok: false, code: "JOB_NOT_FOUND" };
      const job = await expireIfDue(deps, found);
      return { ok: true, data: toView(job, deps) };
    },

    async cancelJob(id, token) {
      const job = await loadOwned(deps, id, token);
      if (!job) return { ok: false, code: "JOB_NOT_FOUND" };
      if (ACTIVE.includes(job.status)) {
        await deps.repo.update(job.id, ACTIVE, { status: "cancelled" });
      }
      const current = (await deps.repo.get(job.id)) ?? job;
      return { ok: true, data: { id: job.id, status: current.status } };
    },
  };
}

async function loadOwned(deps: JobServiceDeps, id: string, token: string): Promise<JobRecord | null> {
  const job = await deps.repo.get(id);
  if (!job || !verifyToken(token, job.tokenHash)) return null;
  return job;
}

// Lazy timeout: a non-terminal job past its deadline becomes timed_out even if its pipeline run is gone.
async function expireIfDue(deps: JobServiceDeps, job: JobRecord): Promise<JobRecord> {
  const deadline = deadlineOf(job).getTime();
  if (!ACTIVE.includes(job.status) || deps.now().getTime() < deadline) return job;
  await deps.repo.update(job.id, ACTIVE, { status: "timed_out", failureReason: "TIMED_OUT" });
  return (await deps.repo.get(job.id)) ?? job;
}

function deadlineOf(job: JobRecord): Date {
  return new Date(job.requestedAt.getTime() + JOB_DEADLINE_MS);
}

function toPublic(job: JobRecord): PublicJob {
  return {
    id: job.id,
    status: job.status,
    requestedAt: job.requestedAt.toISOString(),
    deadlineAt: deadlineOf(job).toISOString(),
  };
}

function toView(job: JobRecord, deps: JobServiceDeps): JobStatusView {
  const base = toPublic(job);
  return {
    ...base,
    modelUrl: job.status === "ready" && job.modelKey ? deps.signModelUrl(job.modelKey, MODEL_URL_TTL_SECONDS) : null,
    failure: failureFor(job),
  };
}

function failureFor(job: JobRecord): JobStatusView["failure"] {
  if (!TERMINAL_FAILURE.includes(job.status)) return null;
  const code = (job.failureReason ?? "INTERNAL") as ErrorCode;
  const spec = ERROR_TABLE[code] ?? ERROR_TABLE.INTERNAL;
  return { code, message: spec.message, retryable: spec.retryable };
}
