import { describe, expect, it } from "vitest";
import { detectImageType } from "../../api/lib/image-check";

describe("detectImageType (magic-byte validation)", () => {
  it("accepts JPEG by its FF D8 FF signature", () => {
    expect(detectImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0]))).toBe("image/jpeg");
  });

  it("accepts PNG by its 89 50 4E 47 signature", () => {
    expect(detectImageType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]))).toBe("image/png");
  });

  it("accepts WebP by its RIFF....WEBP signature", () => {
    const bytes = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
    expect(detectImageType(bytes)).toBe("image/webp");
  });

  it("returns null for other content, even if the declared type says image", () => {
    expect(detectImageType(new TextEncoder().encode("<html>not an image</html>"))).toBeNull();
  });

  it("returns null for files too short to carry a signature", () => {
    expect(detectImageType(new Uint8Array([0xff]))).toBeNull();
  });
});
