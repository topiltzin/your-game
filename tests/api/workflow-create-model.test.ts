import { describe, expect, it } from "vitest";
import { createModel, type CreateModelDeps, type CreateModelJob } from "../../workflows/create-model-core";
import { ExternalServiceError } from "../../workflows/sf3d-client";

const JOB: CreateModelJob = {
  id: "job-1",
  inputKey: "inputs/job-1.jpg",
  textureResolution: 1024,
  deadlineAt: new Date("2026-11-18T12:10:00.000Z"),
};

function fakeDeps(overrides: Partial<CreateModelDeps> = {}) {
  const calls: string[] = [];
  const state = { status: "queued" as string, modelKey: null as string | null, failureReason: null as string | null, deletedInput: false, discarded: [] as string[] };
  const deps: CreateModelDeps = {
    now: () => new Date("2026-11-18T12:01:00.000Z"),
    markProcessing: async () => {
      calls.push("markProcessing");
      if (state.status !== "queued") return false;
      state.status = "processing";
      return true;
    },
    readInput: async () => new Uint8Array([1, 2, 3]),
    prepareImage: async (bytes) => bytes,
    generateModel: async () => new Uint8Array([9, 9, 9]),
    storeModel: async (jobId) => {
      calls.push("storeModel");
      return `models/${jobId}.glb`;
    },
    markReady: async (_id, modelKey) => {
      calls.push("markReady");
      if (state.status !== "processing") return false;
      state.status = "ready";
      state.modelKey = modelKey;
      return true;
    },
    markTerminal: async (_id, status, reason) => {
      calls.push(`markTerminal:${status}`);
      if (state.status !== "processing" && state.status !== "queued") return false;
      state.status = status;
      state.failureReason = reason;
      return true;
    },
    discardModel: async (key) => void state.discarded.push(key),
    deleteInput: async () => void (state.deletedInput = true),
    ...overrides,
  };
  return { deps, state, calls };
}

describe("createModel (durable create-model core)", () => {
  it("moves queued → processing → ready and deletes the input", async () => {
    const { deps, state } = fakeDeps();
    const outcome = await createModel(JOB, deps);
    expect(outcome).toBe("ready");
    expect(state.status).toBe("ready");
    expect(state.modelKey).toBe("models/job-1.glb");
    expect(state.deletedInput).toBe(true);
  });

  it("skips work when the job was already cancelled or timed out before it started", async () => {
    const { deps, state } = fakeDeps();
    state.status = "cancelled";
    const outcome = await createModel(JOB, deps);
    expect(outcome).toBe("skipped");
    expect(state.modelKey).toBeNull();
  });

  it("discards the stored model when the job was cancelled during generation", async () => {
    const { deps, state } = fakeDeps({
      generateModel: async () => {
        state.status = "cancelled"; // player cancels while the external call runs
        return new Uint8Array([1]);
      },
    });
    const outcome = await createModel(JOB, deps);
    expect(outcome).toBe("discarded");
    expect(state.discarded).toEqual(["models/job-1.glb"]);
    expect(state.status).toBe("cancelled");
  });

  it("maps a service error to failed with a fixed reason, never raw upstream text", async () => {
    const { deps, state } = fakeDeps({
      generateModel: async () => {
        throw new ExternalServiceError("upstream 500: <html>secret stack trace</html>", { retryable: true });
      },
    });
    const outcome = await createModel(JOB, deps);
    expect(outcome).toBe("failed");
    expect(state.status).toBe("failed");
    expect(state.failureReason).toBe("SERVICE_UNAVAILABLE");
    expect(JSON.stringify(state)).not.toContain("secret stack trace");
  });

  it("times out when the deadline has passed before generation starts", async () => {
    const { deps, state } = fakeDeps({ now: () => new Date("2026-11-18T12:11:00.000Z") });
    const outcome = await createModel(JOB, deps);
    expect(outcome).toBe("timed_out");
    expect(state.status).toBe("timed_out");
    expect(state.failureReason).toBe("TIMED_OUT");
  });
});
