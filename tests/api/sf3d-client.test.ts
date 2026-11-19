import { describe, expect, it } from "vitest";
import { ExternalServiceError, callImageTo3d } from "../../workflows/sf3d-client";

const IMAGE = new Uint8Array([1, 2, 3]);

function fetchReturning(response: Response): typeof fetch {
  return async () => response;
}

describe("callImageTo3d (external image-to-3D service)", () => {
  it("returns the model bytes on success", async () => {
    const body = new Uint8Array([0x67, 0x6c, 0x54, 0x46, 7, 7, 7]); // "glTF" + payload
    const bytes = await callImageTo3d(IMAGE, 1024, {
      endpoint: "https://example.test/generate-3d/",
      timeoutMs: 5000,
      fetch: fetchReturning(new Response(body, { status: 200 })),
    });
    expect(Array.from(bytes)).toEqual(Array.from(body));
  });

  it("rejects a 200 with an empty body instead of storing an empty model", async () => {
    const error = await callImageTo3d(IMAGE, 1024, {
      endpoint: "https://example.test/generate-3d/",
      timeoutMs: 5000,
      fetch: fetchReturning(new Response(new Uint8Array(0), { status: 200 })),
    }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ExternalServiceError);
    expect((error as ExternalServiceError).retryable).toBe(false);
  });

  it("rejects a 200 with a JSON error body instead of storing it as a model", async () => {
    const error = await callImageTo3d(IMAGE, 1024, {
      endpoint: "https://example.test/generate-3d/",
      timeoutMs: 5000,
      fetch: fetchReturning(new Response(JSON.stringify({ detail: "bad image" }), { status: 200 })),
    }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ExternalServiceError);
    expect((error as ExternalServiceError).retryable).toBe(false);
  });

  it("maps a 503 to a retryable ExternalServiceError without copying the body", async () => {
    const error = await callImageTo3d(IMAGE, 1024, {
      endpoint: "https://example.test/generate-3d/",
      timeoutMs: 5000,
      fetch: fetchReturning(new Response("<html>internal details</html>", { status: 503 })),
    }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ExternalServiceError);
    expect((error as ExternalServiceError).retryable).toBe(true);
    expect((error as Error).message).not.toContain("internal details");
  });

  it("treats a timeout as a non-retryable ExternalServiceError", async () => {
    const slow: typeof fetch = (_url, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      });
    const error = await callImageTo3d(IMAGE, 1024, { endpoint: "https://example.test/x", timeoutMs: 10, fetch: slow }).catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(ExternalServiceError);
    expect((error as ExternalServiceError).retryable).toBe(false);
  });
});
