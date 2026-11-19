import { beforeEach, describe, expect, it, vi } from "vitest";

// Every adapter reads the Supabase client through createSupabase(). The mock returns a fake client
// whose Storage and table calls are controlled per test, so no network is used.
const fake = vi.hoisted(() => ({
  client: null as unknown as Record<string, unknown>,
}));

vi.mock("../../server/lib/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../server/lib/db")>();
  return { ...actual, createSupabase: () => fake.client };
});

import { createBlobStore, isNotFound, SKETCH_BUCKET } from "../../server/lib/blob";
import { createProductionDeps } from "../../workflows/deps";
import { createWorkerDeps } from "../../worker/index";

type Result = { data?: unknown; error?: { message: string; statusCode?: string } | null };

function storageBucket(overrides: Partial<Record<"upload" | "download" | "remove", (...args: unknown[]) => Promise<Result>>> = {}) {
  const calls: { method: string; args: unknown[] }[] = [];
  const bucket = {
    upload: async (...args: unknown[]) => {
      calls.push({ method: "upload", args });
      return overrides.upload ? overrides.upload(...args) : { data: {}, error: null };
    },
    download: async (...args: unknown[]) => {
      calls.push({ method: "download", args });
      return overrides.download ? overrides.download(...args) : { data: new Blob([new Uint8Array([7, 8])]), error: null };
    },
    remove: async (...args: unknown[]) => {
      calls.push({ method: "remove", args });
      return overrides.remove ? overrides.remove(...args) : { data: [], error: null };
    },
  };
  return { bucket, calls };
}

/** Fake client whose table calls resolve to `result`; every call is recorded. */
function tableClient(result: Result) {
  const calls: { method: string; args: unknown[] }[] = [];
  const builder: Record<string, unknown> = new Proxy(
    {},
    {
      get(_target, prop: string) {
        if (prop === "then") {
          return (resolve: (value: unknown) => unknown) => Promise.resolve({ data: null, error: null, ...result }).then(resolve);
        }
        return (...args: unknown[]) => {
          calls.push({ method: prop, args });
          return builder;
        };
      },
    },
  );
  return { from: () => builder, rpc: async () => ({ data: null, error: null }), storage: { from: () => builder }, calls };
}

describe("Supabase Storage blob adapter", () => {
  beforeEach(() => {
    fake.client = {};
  });

  it("uploads to the sketch-runner bucket with the content type and no overwrite", async () => {
    const { bucket, calls } = storageBucket();
    fake.client = { storage: { from: () => bucket } };
    await createBlobStore().putPrivate("inputs/a.jpg", new Uint8Array([1]), "image/jpeg");
    expect(SKETCH_BUCKET).toBe("sketch-runner");
    expect(calls[0]).toEqual({
      method: "upload",
      args: ["inputs/a.jpg", new Uint8Array([1]), { contentType: "image/jpeg", upsert: false }],
    });
  });

  it("throws when an upload fails", async () => {
    const { bucket } = storageBucket({ upload: async () => ({ error: { message: "quota exceeded" } }) });
    fake.client = { storage: { from: () => bucket } };
    await expect(createBlobStore().putPrivate("inputs/a.jpg", new Uint8Array([1]), "image/jpeg")).rejects.toThrow(
      "storage upload failed: quota exceeded",
    );
  });

  it("downloads the bytes, and returns null for a missing object", async () => {
    const { bucket } = storageBucket();
    fake.client = { storage: { from: () => bucket } };
    expect(Array.from((await createBlobStore().getPrivate("inputs/a.jpg")) ?? [])).toEqual([7, 8]);

    const missing = storageBucket({ download: async () => ({ error: { message: "Object not found", statusCode: "404" } }) });
    fake.client = { storage: { from: () => missing.bucket } };
    expect(await createBlobStore().getPrivate("inputs/a.jpg")).toBeNull();
  });

  it("throws on a download failure that is not a missing object", async () => {
    const { bucket } = storageBucket({ download: async () => ({ error: { message: "unauthorized", statusCode: "403" } }) });
    fake.client = { storage: { from: () => bucket } };
    await expect(createBlobStore().getPrivate("inputs/a.jpg")).rejects.toThrow("storage download failed: unauthorized");
  });

  it("removes one object by path", async () => {
    const { bucket, calls } = storageBucket();
    fake.client = { storage: { from: () => bucket } };
    await createBlobStore().deletePrivate("models/job-1.glb");
    expect(calls[0]).toEqual({ method: "remove", args: [["models/job-1.glb"]] });
  });

  it("isNotFound recognises 404 codes and not-found messages only", () => {
    expect(isNotFound({ statusCode: "404" })).toBe(true);
    expect(isNotFound({ message: "The resource was not found" })).toBe(true);
    expect(isNotFound({ statusCode: "500", message: "boom" })).toBe(false);
  });
});

describe("production pipeline wiring", () => {
  it("accepts a claimed job: markProcessing updates from queued or processing", async () => {
    const client = tableClient({ data: [{ id: "job-1" }] });
    fake.client = client as unknown as Record<string, unknown>;
    const deps = createProductionDeps("https://sf3d.example/generate-3d/");

    expect(await deps.markProcessing("job-1")).toBe(true);
    expect(client.calls.find((c) => c.method === "in")?.args).toEqual(["status", ["queued", "processing"]]);
  });

  it("requires an SF3D endpoint", () => {
    fake.client = tableClient({}) as unknown as Record<string, unknown>;
    expect(() => createProductionDeps(undefined)).toThrow("SF3D_API_URL is not set");
  });
});

describe("createWorkerDeps", () => {
  it("builds the worker's dependencies with the worker id in every log line", () => {
    fake.client = tableClient({ data: [] }) as unknown as Record<string, unknown>;
    const lines: string[] = [];
    const spy = vi.spyOn(console, "log").mockImplementation((line: string) => void lines.push(line));
    try {
      const deps = createWorkerDeps("vm-1", 5000, "https://sf3d.example/generate-3d/");
      expect(deps.workerId).toBe("vm-1");
      expect(deps.pollMs).toBe(5000);
      deps.log("hello");
      expect(lines[0]).toContain("worker vm-1 hello");
    } finally {
      spy.mockRestore();
    }
  });
});
