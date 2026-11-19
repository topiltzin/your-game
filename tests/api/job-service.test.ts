import { describe, expect, it } from "vitest";
import { createJobService, type JobRecord, type JobRepository } from "../../server/lib/job-service";
import { createRateLimiter } from "../../server/lib/rate-limit";
import { hashToken } from "../../server/lib/job-token";

const T0 = new Date("2026-11-18T12:00:00.000Z");
const TEN_MIN = 10 * 60 * 1000;

function memoryRepo(): JobRepository & { jobs: Map<string, JobRecord>; countSince(h: string, s: Date): Promise<number> } {
  const jobs = new Map<string, JobRecord>();
  return {
    jobs,
    async insert(job) {
      jobs.set(job.id, job);
    },
    async get(id) {
      return jobs.get(id) ?? null;
    },
    async update(id, from, patch) {
      const job = jobs.get(id);
      if (!job || !from.includes(job.status)) return false;
      jobs.set(id, { ...job, ...patch });
      return true;
    },
    async findActiveByInput(inputKey) {
      return [...jobs.values()].find((j) => j.inputKey === inputKey && (j.status === "queued" || j.status === "processing")) ?? null;
    },
    async countSince(ipHash, since) {
      return [...jobs.values()].filter((j) => j.ipHash === ipHash && j.requestedAt >= since).length;
    },
  };
}

function setup(now: Date = T0) {
  const repo = memoryRepo();
  const started: string[] = [];
  let counter = 0;
  const service = createJobService({
    repo,
    rateLimiter: createRateLimiter({ limit: 5, windowMs: 60 * 60 * 1000, countSince: (h, s) => repo.countSince(h, s) }),
    startWorkflow: async (jobId) => void started.push(jobId),
    now: () => now,
    newId: () => `job-${++counter}`,
    newToken: () => "fixed-token-256bit",
    ipHash: () => "ip-hash-1",
    signModelUrl: (key) => `https://blob.test/${key}?sig=1`,
  });
  return { repo, service, started };
}

describe("POST /api/jobs (createJob)", () => {
  it("rejects when the disclosure is not accepted (FR-007)", async () => {
    const { service } = setup();
    const r = await service.createJob({ inputKey: "inputs/a.png", textureResolution: 1024, disclosureAccepted: false });
    expect(r).toEqual({ ok: false, code: "DISCLOSURE_REQUIRED" });
  });

  it("rejects a texture resolution outside {512, 1024}", async () => {
    const { service } = setup();
    const r = await service.createJob({ inputKey: "inputs/a.png", textureResolution: 2048 as 512, disclosureAccepted: true });
    expect(r).toEqual({ ok: false, code: "VALIDATION" });
  });

  it("creates a queued job with a 10-minute deadline and returns the token once", async () => {
    const { service, repo, started } = setup();
    const r = await service.createJob({ inputKey: "inputs/a.png", textureResolution: 1024, disclosureAccepted: true });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.job.status).toBe("queued");
    expect(new Date(r.job.deadlineAt).getTime() - new Date(r.job.requestedAt).getTime()).toBe(TEN_MIN);
    expect(r.accessToken).toBe("fixed-token-256bit");
    expect(repo.jobs.get(r.job.id)!.tokenHash).toBe(hashToken("fixed-token-256bit"));
    expect(started).toEqual([r.job.id]);
  });

  it("stores only a hash of the IP, never the raw IP", async () => {
    const { service, repo } = setup();
    const r = await service.createJob({ inputKey: "inputs/a.png", textureResolution: 1024, disclosureAccepted: true });
    if (!r.ok) throw new Error("expected ok");
    expect(repo.jobs.get(r.job.id)!.ipHash).toBe("ip-hash-1");
    expect(JSON.stringify([...repo.jobs.values()])).not.toContain("127.0.0.1");
  });

  it("returns JOB_ALREADY_ACTIVE for a second active job on the same input", async () => {
    const { service } = setup();
    const input = { inputKey: "inputs/a.png", textureResolution: 1024 as const, disclosureAccepted: true };
    await service.createJob(input);
    const second = await service.createJob(input);
    expect(second).toEqual({ ok: false, code: "JOB_ALREADY_ACTIVE" });
  });

  it("returns RATE_LIMITED after 5 creations from the same IP hash within an hour", async () => {
    const { service } = setup();
    for (let i = 0; i < 5; i++) {
      await service.createJob({ inputKey: `inputs/${i}.png`, textureResolution: 512, disclosureAccepted: true });
    }
    const sixth = await service.createJob({ inputKey: "inputs/6.png", textureResolution: 512, disclosureAccepted: true });
    expect(sixth).toEqual({ ok: false, code: "RATE_LIMITED" });
  });
});

describe("GET /api/jobs/{id} (getJob)", () => {
  it("returns JOB_NOT_FOUND for a wrong token, the same as a missing job", async () => {
    const { service } = setup();
    const created = await service.createJob({ inputKey: "inputs/a.png", textureResolution: 1024, disclosureAccepted: true });
    if (!created.ok) throw new Error("expected ok");
    expect(await service.getJob(created.job.id, "wrong-token")).toEqual({ ok: false, code: "JOB_NOT_FOUND" });
    expect(await service.getJob("missing", "wrong-token")).toEqual({ ok: false, code: "JOB_NOT_FOUND" });
  });

  it("moves a non-terminal job past its deadline to timed_out (lazy timeout)", async () => {
    const created = setup(T0);
    const r = await created.service.createJob({ inputKey: "inputs/a.png", textureResolution: 1024, disclosureAccepted: true });
    if (!r.ok) throw new Error("expected ok");
    const later = createJobServiceAt(created.repo, new Date(T0.getTime() + TEN_MIN + 1000));
    const status = await later.getJob(r.job.id, "fixed-token-256bit");
    expect(status.ok && status.data.status).toBe("timed_out");
    expect(status.ok && status.data.failure?.code).toBe("TIMED_OUT");
  });

  it("returns a signed modelUrl only when ready", async () => {
    const created = setup(T0);
    const r = await created.service.createJob({ inputKey: "inputs/a.png", textureResolution: 1024, disclosureAccepted: true });
    if (!r.ok) throw new Error("expected ok");
    await created.repo.update(r.job.id, ["queued"], { status: "processing" });
    await created.repo.update(r.job.id, ["processing"], { status: "ready", modelKey: "models/x.glb" });
    const status = await created.service.getJob(r.job.id, "fixed-token-256bit");
    expect(status.ok && status.data.status).toBe("ready");
    expect(status.ok && status.data.modelUrl).toMatch(/^https:\/\//);
  });
});

describe("DELETE /api/jobs/{id} (cancelJob)", () => {
  it("cancels a queued job and is idempotent", async () => {
    const { service } = setup();
    const r = await service.createJob({ inputKey: "inputs/a.png", textureResolution: 1024, disclosureAccepted: true });
    if (!r.ok) throw new Error("expected ok");
    expect(await service.cancelJob(r.job.id, "fixed-token-256bit")).toEqual({ ok: true, data: { id: r.job.id, status: "cancelled" } });
    expect(await service.cancelJob(r.job.id, "fixed-token-256bit")).toEqual({ ok: true, data: { id: r.job.id, status: "cancelled" } });
  });
});

// Same repository, different clock: used to simulate time passing.
function createJobServiceAt(repo: JobRepository, now: Date) {
  return createJobService({
    repo,
    rateLimiter: createRateLimiter({ limit: 5, windowMs: 60 * 60 * 1000, countSince: async () => 0 }),
    startWorkflow: async () => undefined,
    now: () => now,
    newId: () => "unused",
    newToken: () => "unused",
    ipHash: () => "ip-hash-1",
    signModelUrl: (key) => `https://blob.test/${key}?sig=1`,
  });
}
