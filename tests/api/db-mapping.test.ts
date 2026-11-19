import { describe, expect, it } from "vitest";
import { toRecord, type JobRow } from "../../server/lib/db";

const ROW: JobRow = {
  id: "11111111-1111-4111-8111-111111111111",
  access_token_hash: "hash-of-token",
  status: "processing",
  input_key: "inputs/11111111.jpg",
  texture_resolution: 512,
  model_key: null,
  failure_reason: null,
  requested_at: "2026-11-18T12:00:00.000+00:00",
  ip_hash: "ip-hash",
};

describe("toRecord", () => {
  it("maps a Supabase row to the job record the service uses", () => {
    const record = toRecord(ROW);
    expect(record).toEqual({
      id: ROW.id,
      tokenHash: "hash-of-token",
      status: "processing",
      inputKey: "inputs/11111111.jpg",
      textureResolution: 512,
      modelKey: null,
      failureReason: null,
      requestedAt: new Date("2026-11-18T12:00:00.000Z"),
      ipHash: "ip-hash",
    });
  });

  it("falls back to 1024 for any texture resolution other than 512", () => {
    expect(toRecord({ ...ROW, texture_resolution: 1024 }).textureResolution).toBe(1024);
  });
});
