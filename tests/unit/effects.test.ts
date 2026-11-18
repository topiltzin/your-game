import { describe, expect, it } from "vitest";
import { ParticlePool } from "../../src/game/effects/particles";
import { parallaxOffsets } from "../../src/game/effects/parallax";
import { presentationAvailability, spriteSourceFor } from "../../src/screens/mode-availability";

describe("particle pool (FR-022)", () => {
  it("never holds more particles than its cap", () => {
    const pool = new ParticlePool(10);
    for (let i = 0; i < 50; i++) pool.spawn({ x: 0, y: 0, vx: 1, vy: 1, life: 1 });
    expect(pool.active()).toBeLessThanOrEqual(10);
  });

  it("recycles particles whose life has expired", () => {
    const pool = new ParticlePool(5);
    pool.spawn({ x: 0, y: 0, vx: 0, vy: 0, life: 0.1 });
    pool.update(0.2);
    expect(pool.active()).toBe(0);
  });

  it("spawns nothing when disabled (reduced motion)", () => {
    const pool = new ParticlePool(5, { enabled: false });
    pool.spawn({ x: 0, y: 0, vx: 0, vy: 0, life: 1 });
    expect(pool.active()).toBe(0);
  });
});

describe("parallax (FR-024)", () => {
  it("layers move at different fractions of the run distance and wrap", () => {
    const offsets = parallaxOffsets(1000, 400, [0.2, 0.5, 1]);
    expect(offsets[0]).toBeCloseTo(200);
    expect(offsets[1]).toBeCloseTo(100); // 1000 * 0.5 = 500, wrapped to 400
    expect(offsets.every((o) => o >= 0 && o < 400)).toBe(true);
  });
});

describe("presentation availability (FR-009, FR-010)", () => {
  it("2D is always available", () => {
    expect(presentationAvailability({ modelStatus: "failed", webgl: false }, "2d")).toEqual({ available: true });
  });

  it("3D is unavailable with a reason when the model failed", () => {
    const result = presentationAvailability({ modelStatus: "failed", webgl: true }, "3d");
    expect(result).toMatchObject({ available: false, reason: expect.stringMatching(/2D/) });
  });

  it("3D is unavailable when WebGL is missing", () => {
    expect(presentationAvailability({ modelStatus: "ready", webgl: false }, "3d").available).toBe(false);
  });

  it("3D is available when the model is ready and WebGL works", () => {
    expect(presentationAvailability({ modelStatus: "ready", webgl: true }, "3d").available).toBe(true);
  });

  it("sprite source is the sketch for 2D and the model for 3D", () => {
    expect(spriteSourceFor("2d")).toBe("sketch");
    expect(spriteSourceFor("3d")).toBe("model");
  });
});
