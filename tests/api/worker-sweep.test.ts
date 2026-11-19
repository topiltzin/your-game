import { describe, expect, it } from "vitest";
import { runWorkerCycle, type WorkerDeps } from "../../worker/index";

// Each cycle first marks jobs past their deadline (fail_stale_model_jobs), so a job whose worker
// died is never left waiting forever. The sweep runs before the claim, so the claim sees a clean queue.

function fakeWorker(sweepCount: number) {
  const calls: string[] = [];
  const log: string[] = [];
  const deps: WorkerDeps = {
    workerId: "worker-a",
    pollMs: 5000,
    claim: async () => {
      calls.push("claim");
      return null;
    },
    run: async () => "ready",
    sweep: async () => {
      calls.push("sweep");
      return sweepCount;
    },
    sleep: async () => undefined,
    log: (message) => void log.push(message),
  };
  return { deps, calls, log };
}

describe("worker cycle sweeps stale jobs", () => {
  it("sweeps before it claims", async () => {
    const { deps, calls } = fakeWorker(0);
    await runWorkerCycle(deps);
    expect(calls).toEqual(["sweep", "claim"]);
  });

  it("logs the number of jobs the sweep timed out", async () => {
    const { deps, log } = fakeWorker(2);
    await runWorkerCycle(deps);
    expect(log.some((m) => m.includes("2") && m.includes("timed out"))).toBe(true);
  });

  it("does not log when the sweep finds nothing", async () => {
    const { deps, log } = fakeWorker(0);
    await runWorkerCycle(deps);
    expect(log.some((m) => m.includes("timed out"))).toBe(false);
  });
});
