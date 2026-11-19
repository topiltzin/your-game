import { describe, expect, it } from "vitest";
import { createJobService, type JobRecord, type JobRepository, type JobServiceDeps } from "../../server/lib/job-service";
import { createRateLimiter } from "../../server/lib/rate-limit";

// POST /api/jobs must only record the job. The worker picks it up later, so the request never
// starts the 3D pipeline. The deps below deliberately have no pipeline starter.

function memoryRepo(): JobRepository & { jobs: Map<string, JobRecord> } {
  const jobs = new Map<string, JobRecord>();
  return {
    jobs,
    async insert(job) {
      jobs.set(job.id, job);
    },
    async get(id) {
      return jobs.get(id) ?? null;
    },
    async update() {
      return false;
    },
    async findActiveByInput() {
      return null;
    },
    async countSince() {
      return 0;
    },
  } as JobRepository & { jobs: Map<string, JobRecord> };
}

function setup() {
  const repo = memoryRepo();
  const deps = {
    repo,
    rateLimiter: createRateLimiter({ limit: 5, windowMs: 60 * 60 * 1000, countSince: async () => 0 }),
    now: () => new Date("2026-11-18T12:00:00.000Z"),
    newId: () => "job-1",
    newToken: () => "fixed-token-256bit",
    ipHash: () => "ip-hash-1",
    signModelUrl: (key: string) => `https://storage.test/${key}`,
  } as unknown as JobServiceDeps;
  return { repo, service: createJobService(deps) };
}

describe("POST /api/jobs (createJob) does not run the pipeline", () => {
  it("returns a queued job and records it, without starting any pipeline", async () => {
    const { repo, service } = setup();
    const result = await service.createJob({ inputKey: "inputs/a.jpg", textureResolution: 1024, disclosureAccepted: true });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.job.status).toBe("queued");
    expect(repo.jobs.get("job-1")?.status).toBe("queued");
  });
});
