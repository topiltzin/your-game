import { describe, expect, it } from "vitest";
import { claimNextJob, sweepStaleJobs } from "../../worker/claim";
import { JOB_DEADLINE_MS } from "../../server/lib/job-service";

const ROW = {
  id: "11111111-1111-4111-8111-111111111111",
  input_key: "inputs/11111111-1111-4111-8111-111111111111.jpg",
  texture_resolution: 512,
  requested_at: "2026-11-18T12:00:00.000+00:00",
};

function fakeClient(result: { data: unknown; error: { message: string } | null }) {
  const calls: { name: string; args: Record<string, unknown> }[] = [];
  const client = {
    rpc: async (name: string, args: Record<string, unknown>) => {
      calls.push({ name, args });
      return result;
    },
  };
  return { client: client as unknown as Parameters<typeof claimNextJob>[0], calls };
}

describe("claimNextJob", () => {
  it("calls claim_model_job with the worker id and maps the row to a pipeline job", async () => {
    const { client, calls } = fakeClient({ data: ROW, error: null });
    const job = await claimNextJob(client, "worker-a");

    expect(calls).toEqual([{ name: "claim_model_job", args: { p_worker_id: "worker-a" } }]);
    expect(job).toEqual({
      id: ROW.id,
      inputKey: ROW.input_key,
      textureResolution: 512,
      deadlineAt: new Date(new Date(ROW.requested_at).getTime() + JOB_DEADLINE_MS),
    });
  });

  it("accepts a single-element array result", async () => {
    const { client } = fakeClient({ data: [ROW], error: null });
    expect((await claimNextJob(client, "w"))?.id).toBe(ROW.id);
  });

  it("returns null when the queue is empty (no row)", async () => {
    const { client } = fakeClient({ data: null, error: null });
    expect(await claimNextJob(client, "w")).toBeNull();
  });

  it("returns null when the result is a row of nulls", async () => {
    const { client } = fakeClient({ data: { id: null, input_key: null }, error: null });
    expect(await claimNextJob(client, "w")).toBeNull();
  });

  it("throws with the database message when the RPC fails", async () => {
    const { client } = fakeClient({ data: null, error: { message: "permission denied" } });
    await expect(claimNextJob(client, "w")).rejects.toThrow("claim model job failed: permission denied");
  });
});

describe("sweepStaleJobs", () => {
  it("calls fail_stale_model_jobs and returns the count", async () => {
    const { client, calls } = fakeClient({ data: 3, error: null });
    expect(await sweepStaleJobs(client)).toBe(3);
    expect(calls).toEqual([{ name: "fail_stale_model_jobs", args: {} }]);
  });

  it("returns 0 when the RPC returns nothing", async () => {
    const { client } = fakeClient({ data: null, error: null });
    expect(await sweepStaleJobs(client)).toBe(0);
  });

  it("throws when the RPC fails", async () => {
    const { client } = fakeClient({ data: null, error: { message: "timeout" } });
    await expect(sweepStaleJobs(client)).rejects.toThrow("sweep stale model jobs failed: timeout");
  });
});
