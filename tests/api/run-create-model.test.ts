import { describe, expect, it } from "vitest";
import { runCreateModel } from "../../workflows/create-model";
import type { CreateModelDeps, CreateModelJob } from "../../workflows/create-model-core";

const JOB: CreateModelJob = {
  id: "job-1",
  inputKey: "inputs/job-1.jpg",
  textureResolution: 1024,
  deadlineAt: new Date("2026-11-18T12:10:00.000Z"),
};

function depsWith(overrides: Partial<CreateModelDeps>): { deps: CreateModelDeps; terminal: string[] } {
  const terminal: string[] = [];
  const deps: CreateModelDeps = {
    now: () => new Date("2026-11-18T12:01:00.000Z"),
    markProcessing: async () => true,
    readInput: async () => new Uint8Array([1]),
    prepareImage: async (bytes) => bytes,
    generateModel: async () => new Uint8Array([9]),
    storeModel: async () => "models/job-1.glb",
    markReady: async () => true,
    markTerminal: async (_id, status, reason) => {
      terminal.push(`${status}:${reason}`);
      return true;
    },
    discardModel: async () => undefined,
    deleteInput: async () => undefined,
    ...overrides,
  };
  return { deps, terminal };
}

describe("runCreateModel", () => {
  it("returns the pipeline outcome when nothing unexpected happens", async () => {
    const { deps, terminal } = depsWith({});
    expect(await runCreateModel(JOB, deps)).toBe("ready");
    expect(terminal).toEqual([]);
  });

  it("marks the job failed instead of rejecting when an unexpected error escapes the pipeline", async () => {
    const { deps, terminal } = depsWith({
      readInput: async () => {
        throw new Error("blob store unreachable");
      },
    });
    expect(await runCreateModel(JOB, deps)).toBe("failed");
    expect(terminal).toEqual(["failed:SERVICE_UNAVAILABLE"]);
  });
});
