import { describe, expect, it } from "vitest";
import { isNotFound, SKETCH_BUCKET } from "../../server/lib/blob";

describe("isNotFound", () => {
  it("treats a 404 status code as a missing object", () => {
    expect(isNotFound({ statusCode: "404", message: "whatever" })).toBe(true);
  });

  it("treats a 'not found' message as a missing object", () => {
    expect(isNotFound({ message: "Object not found" })).toBe(true);
  });

  it("does not treat other storage failures as missing objects", () => {
    expect(isNotFound({ statusCode: "500", message: "internal error" })).toBe(false);
  });
});

describe("SKETCH_BUCKET", () => {
  it("matches the bucket created by the 0002 migration", () => {
    expect(SKETCH_BUCKET).toBe("sketch-runner");
  });
});
