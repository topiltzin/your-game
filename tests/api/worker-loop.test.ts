import { describe, expect, it } from "vitest";
import { runWorkerCycle, runWorkerLoop, type WorkerDeps } from "../../worker/index";
import type { CreateModelJob } from "../../workflows/create-model-core";

const JOB: CreateModelJob = {
  id: "job-1",
  inputKey: "inputs/job-1.jpg",
  textureResolution: 1024,
  deadlineAt: new Date("2026-11-18T12:10:00.000Z"),
};

function fakeWorker(overrides: Partial<WorkerDeps> = {}) {
  const log: string[] = [];
  const ran: CreateModelJob[] = [];
  const deps: WorkerDeps = {
    workerId: "worker-a",
    pollMs: 5000,
    claim: async () => null,
    run: async (job) => {
      ran.push(job);
      return "ready";
    },
    sweep: async () => 0,
    sleep: async () => undefined,
    log: (message) => void log.push(message),
    ...overrides,
  };
  return { deps, log, ran };
}

describe("runWorkerCycle", () => {
  it("claims a queued job and runs it through the pipeline", async () => {
    const { deps, ran } = fakeWorker({ claim: async () => JOB });
    expect(await runWorkerCycle(deps)).toBe(true);
    expect(ran).toEqual([JOB]);
  });

  it("returns false and runs nothing when the queue is empty", async () => {
    const { deps, ran } = fakeWorker({ claim: async () => null });
    expect(await runWorkerCycle(deps)).toBe(false);
    expect(ran).toEqual([]);
  });
});

describe("runWorkerLoop", () => {
  it("logs an error and keeps going when a cycle throws", async () => {
    let claims = 0;
    const stop = { stopped: false };
    const { deps, log } = fakeWorker({
      claim: async () => {
        claims += 1;
        if (claims === 1) throw new Error("database unreachable");
        stop.stopped = true;
        return null;
      },
    });

    await runWorkerLoop(deps, stop);

    expect(claims).toBe(2);
    expect(log.some((m) => m.includes("database unreachable"))).toBe(true);
  });

  it("stops after the stop signal is set, even while idle", async () => {
    const stop = { stopped: false };
    let sleeps = 0;
    const { deps } = fakeWorker({
      claim: async () => null,
      sleep: async (ms) => {
        expect(ms).toBe(5000);
        sleeps += 1;
        if (sleeps === 2) stop.stopped = true;
      },
    });

    await runWorkerLoop(deps, stop);

    expect(sleeps).toBe(2);
  });

  it("does not sleep between back-to-back jobs", async () => {
    const stop = { stopped: false };
    let claims = 0;
    let sleeps = 0;
    const { deps } = fakeWorker({
      claim: async () => {
        claims += 1;
        if (claims > 2) {
          stop.stopped = true;
          return null;
        }
        return JOB;
      },
      sleep: async () => {
        sleeps += 1;
      },
    });

    await runWorkerLoop(deps, stop);

    expect(claims).toBe(3);
    expect(sleeps).toBe(1);
  });
});
