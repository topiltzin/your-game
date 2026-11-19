import { describe, expect, it } from "vitest";
import { createJobRepository, type JobRow } from "../../server/lib/db";
import type { JobRecord } from "../../server/lib/job-service";

// A chainable fake of the Supabase query builder. Every method records its call and returns the
// builder; awaiting the builder resolves to the result given to fakeDb.
function fakeDb(result: { data?: unknown; error?: { message: string } | null; count?: number | null }) {
  const calls: { method: string; args: unknown[] }[] = [];
  const builder: Record<string, unknown> = new Proxy(
    {},
    {
      get(_target, prop: string) {
        if (prop === "then") {
          return (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
            Promise.resolve({ data: null, error: null, count: null, ...result }).then(resolve, reject);
        }
        return (...args: unknown[]) => {
          calls.push({ method: prop, args });
          return builder;
        };
      },
    },
  );
  const db = {
    from: (table: string) => {
      calls.push({ method: "from", args: [table] });
      return builder;
    },
  };
  return { db: db as unknown as Parameters<typeof createJobRepository>[0], calls };
}

const ROW: JobRow = {
  id: "11111111-1111-4111-8111-111111111111",
  access_token_hash: "hash",
  status: "queued",
  input_key: "inputs/11111111-1111-4111-8111-111111111111.jpg",
  texture_resolution: 1024,
  model_key: null,
  failure_reason: null,
  requested_at: "2026-11-18T12:00:00.000+00:00",
  ip_hash: "ip",
};

const RECORD: JobRecord = {
  id: "11111111-1111-4111-8111-111111111111",
  tokenHash: "hash",
  status: "queued",
  inputKey: ROW.input_key,
  textureResolution: 1024,
  modelKey: null,
  failureReason: null,
  requestedAt: new Date("2026-11-18T12:00:00.000Z"),
  ipHash: "ip",
};

describe("job repository (Supabase)", () => {
  it("insert writes the job columns to model_jobs", async () => {
    const { db, calls } = fakeDb({ error: null });
    await createJobRepository(db).insert(RECORD);
    expect(calls[0]).toEqual({ method: "from", args: ["model_jobs"] });
    const insert = calls.find((c) => c.method === "insert");
    expect(insert?.args[0]).toMatchObject({
      id: RECORD.id,
      access_token_hash: "hash",
      status: "queued",
      input_key: ROW.input_key,
      texture_resolution: 1024,
      requested_at: "2026-11-18T12:00:00.000Z",
      ip_hash: "ip",
    });
  });

  it("insert throws with the database message on error", async () => {
    const { db } = fakeDb({ error: { message: "duplicate key" } });
    await expect(createJobRepository(db).insert(RECORD)).rejects.toThrow("insert model_jobs failed: duplicate key");
  });

  it("get returns the mapped record, or null when no row matches", async () => {
    expect(await createJobRepository(fakeDb({ data: ROW }).db).get(RECORD.id)).toEqual(RECORD);
    expect(await createJobRepository(fakeDb({ data: null }).db).get(RECORD.id)).toBeNull();
  });

  it("update applies only from the allowed statuses and reports whether a row changed", async () => {
    const applied = fakeDb({ data: [{ id: RECORD.id }] });
    expect(await createJobRepository(applied.db).update(RECORD.id, ["queued", "processing"], { status: "processing" })).toBe(true);
    const filter = applied.calls.find((c) => c.method === "in");
    expect(filter?.args).toEqual(["status", ["queued", "processing"]]);

    expect(await createJobRepository(fakeDb({ data: [] }).db).update(RECORD.id, ["processing"], { status: "ready" })).toBe(false);
  });

  it("update leaves out fields that are null or undefined", async () => {
    const { db, calls } = fakeDb({ data: [{ id: RECORD.id }] });
    await createJobRepository(db).update(RECORD.id, ["processing"], { status: "ready", modelKey: null });
    const changes = calls.find((c) => c.method === "update")?.args[0] as Record<string, unknown>;
    expect(changes).toHaveProperty("status", "ready");
    expect(changes).not.toHaveProperty("model_key");
    expect(changes).not.toHaveProperty("failure_reason");
  });

  it("findActiveByInput looks only at queued or processing jobs", async () => {
    const { db, calls } = fakeDb({ data: ROW });
    expect(await createJobRepository(db).findActiveByInput(ROW.input_key)).toEqual(RECORD);
    expect(calls.find((c) => c.method === "in")?.args).toEqual(["status", ["queued", "processing"]]);
  });

  it("countSince counts jobs for the client hash since the given time, and returns 0 for none", async () => {
    const since = new Date("2026-11-18T11:00:00.000Z");
    expect(await createJobRepository(fakeDb({ count: 3 }).db).countSince("ip", since)).toBe(3);
    expect(await createJobRepository(fakeDb({ count: null }).db).countSince("ip", since)).toBe(0);
  });
});
