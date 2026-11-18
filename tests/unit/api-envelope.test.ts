import { describe, expect, it } from "vitest";
import { ApiError, parseEnvelope } from "../../src/api/envelope";
import { validateImageFile } from "../../src/character/image-input";

describe("API envelope parsing (contracts/api.md conventions)", () => {
  it("returns data from a success envelope", () => {
    expect(parseEnvelope({ ok: true, data: { inputKey: "inputs/a.jpg" }, error: null })).toEqual({ inputKey: "inputs/a.jpg" });
  });

  it("throws ApiError with code, message and retryable from an error envelope", () => {
    const body = { ok: false, data: null, error: { code: "RATE_LIMITED", message: "Try later.", retryable: true } };
    try {
      parseEnvelope(body);
      throw new Error("expected throw");
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).code).toBe("RATE_LIMITED");
      expect((error as ApiError).retryable).toBe(true);
    }
  });

  it("throws a generic INTERNAL error when the body is not an envelope", () => {
    expect(() => parseEnvelope("<html>502</html>")).toThrow(ApiError);
  });
});

describe("client image validation (FR-002)", () => {
  it("accepts JPEG, PNG, WebP and HEIC under 10 MB", () => {
    for (const type of ["image/jpeg", "image/png", "image/webp", "image/heic"]) {
      expect(validateImageFile({ type, size: 1_000_000 })).toBeNull();
    }
  });

  it("rejects other types with IMAGE_TYPE_UNSUPPORTED", () => {
    expect(validateImageFile({ type: "image/gif", size: 1000 })).toBe("IMAGE_TYPE_UNSUPPORTED");
  });

  it("rejects files over 10 MB with IMAGE_TOO_LARGE", () => {
    expect(validateImageFile({ type: "image/jpeg", size: 11 * 1024 * 1024 })).toBe("IMAGE_TOO_LARGE");
  });
});
