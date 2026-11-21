import { describe, expect, it } from "vitest";
import { removeBackground } from "../../src/render/sprite-texture";

/** Builds RGBA data from a grid: "x" is ink, anything else is paper-coloured. */
function grid(rows: readonly string[]): { data: Uint8ClampedArray; width: number; height: number } {
  const width = rows[0]!.length;
  const data = new Uint8ClampedArray(width * rows.length * 4);
  rows.forEach((row, y) => {
    for (let x = 0; x < width; x++) {
      const value = row[x] === "x" ? 20 : 250;
      data.set([value, value, value, 255], (y * width + x) * 4);
    }
  });
  return { data, width, height: rows.length };
}

const alphaAt = (data: Uint8ClampedArray, width: number, x: number, y: number) => data[(y * width + x) * 4 + 3];

describe("removeBackground", () => {
  it("makes paper touching the edge transparent", () => {
    const { data, width, height } = grid(["....", ".xx.", ".xx.", "...."]);
    removeBackground(data, width, height);
    expect(alphaAt(data, width, 0, 0)).toBe(0);
    expect(alphaAt(data, width, 3, 3)).toBe(0);
  });

  it("keeps ink opaque", () => {
    const { data, width, height } = grid(["....", ".xx.", ".xx.", "...."]);
    removeBackground(data, width, height);
    expect(alphaAt(data, width, 1, 1)).toBe(255);
  });

  it("keeps white enclosed by the character, such as eye whites", () => {
    const { data, width, height } = grid([".....", ".xxx.", ".x.x.", ".xxx.", "....."]);
    removeBackground(data, width, height);
    expect(alphaAt(data, width, 2, 2)).toBe(255);
    expect(alphaAt(data, width, 0, 2)).toBe(0);
  });
});
