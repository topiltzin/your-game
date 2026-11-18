// Production wiring for the route handlers: database, rate limiter, durable workflow, signed URLs.
import { createHash, randomUUID } from "node:crypto";
import { start } from "workflow/api";
import { createModelWorkflow } from "../../workflows/create-model";
import { createJobRepository, createSql } from "./db";
import { createJobService, JOB_DEADLINE_MS, type JobService } from "./job-service";
import { generateJobToken } from "./job-token";
import { createRateLimiter } from "./rate-limit";
import { signModelUrl } from "./signed-model-url";

const JOB_LIMIT_PER_HOUR = 5;
const HOUR_MS = 60 * 60 * 1000;

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

/** Service for one request. The IP is hashed with a server-side salt; the raw IP is never stored. */
export function createJobServiceForRequest(ip: string, baseUrl: string): JobService {
  const repo = createJobRepository(createSql());
  const salt = env("IP_HASH_SALT");
  const secret = env("MODEL_URL_SECRET");
  return createJobService({
    repo,
    rateLimiter: createRateLimiter({ limit: JOB_LIMIT_PER_HOUR, windowMs: HOUR_MS, countSince: repo.countSince }),
    startWorkflow: async (jobId) => {
      const job = await repo.get(jobId);
      if (!job) throw new Error("job vanished before start");
      await start(createModelWorkflow, [
        {
          id: job.id,
          inputKey: job.inputKey,
          textureResolution: job.textureResolution,
          deadlineAt: new Date(job.requestedAt.getTime() + JOB_DEADLINE_MS),
        },
      ]);
    },
    now: () => new Date(),
    newId: () => randomUUID(),
    newToken: generateJobToken,
    ipHash: () => createHash("sha256").update(`${salt}|${ip}`).digest("hex"),
    signModelUrl: (key, ttlSeconds) => signModelUrl({ key, ttlSeconds, secret, baseUrl, now: new Date() }),
  });
}

export function clientIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

export const MODEL_URL_SECRET = (): string => env("MODEL_URL_SECRET");
