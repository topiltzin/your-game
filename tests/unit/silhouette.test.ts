import { describe, expect, it } from "vitest";
import { extractSilhouette } from "../../src/character/silhouette";

// Build an RGBA buffer of `w`x`h` filled with white opaque paper; `paint` marks dark pixels.
function canvas(w: number, h: number, paint: (x: number, y: number) => boolean): Uint8ClampedArray {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const dark = paint(x, y);
      const v = dark ? 20 : 255;
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
      data[i + 3] = 255;
    }
  }
  return data;
}

const rect = (x0: number, y0: number, x1: number, y1: number) => (x: number, y: number) =>
  x >= x0 && x < x1 && y >= y0 && y < y1;

describe("extractSilhouette", () => {
  it("returns null for a blank page (CHARACTER_UNREADABLE)", () => {
    expect(extractSilhouette(canvas(100, 100, () => false), 100, 100)).toBeNull();
  });

  it("returns null when fewer than 500 foreground pixels remain", () => {
    // 20x20 = 400 pixels, below the 500 threshold
    expect(extractSilhouette(canvas(100, 100, rect(10, 10, 30, 30)), 100, 100)).toBeNull();
  });

  it("measures the bounding box of a solid figure", () => {
    const result = extractSilhouette(canvas(200, 200, rect(40, 50, 90, 150)), 200, 200);
    expect(result).not.toBeNull();
    expect(result!.width).toBe(50);
    expect(result!.height).toBe(100);
  });

  it("keeps the largest connected component and drops smaller strokes", () => {
    const paint = (x: number, y: number) =>
      rect(20, 20, 120, 120)(x, y) || rect(150, 150, 152, 152)(x, y); // big body + tiny speck
    const result = extractSilhouette(canvas(200, 200, paint), 200, 200);
    expect(result!.width).toBe(100);
    expect(result!.height).toBe(100);
  });

  it("drops components under 2% of the largest component's area", () => {
    // Big body 100x100 (10000 px) and a 10x10 detached piece (100 px = 1%)
    const paint = (x: number, y: number) =>
      rect(0, 0, 100, 100)(x, y) || rect(150, 150, 160, 160)(x, y);
    const result = extractSilhouette(canvas(200, 200, paint), 200, 200);
    expect(result!.width).toBe(100);
    expect(result!.height).toBe(100);
  });

  it("treats near-transparent pixels as background", () => {
    const data = canvas(100, 100, rect(0, 0, 100, 100));
    for (let i = 3; i < data.length; i += 4) data[i] = 0; // fully transparent everywhere
    expect(extractSilhouette(data, 100, 100)).toBeNull();
  });
});
