import { describe, expect, it } from "vitest";
import { CONFIG } from "../../src/game/config";
import { createRng } from "../../src/game/rng";
import { generateObstacles, isPassable } from "../../src/game/obstacles";
import { SHORT_WIDE, STANDARD, TALL_NARROW } from "../fixtures/characters";

describe("obstacle generator", () => {
  it("never produces two consecutive impassable obstacles for a given character (oracle 8)", () => {
    for (const metrics of [TALL_NARROW, SHORT_WIDE, STANDARD]) {
      const obstacles = generateObstacles(createRng(42), metrics, 200);
      for (let i = 1; i < obstacles.length; i++) {
        const pair = !isPassable(obstacles[i - 1]!, metrics) && !isPassable(obstacles[i]!, metrics);
        expect(pair).toBe(false);
      }
    }
  });

  it("every obstacle is passable for the character it was generated for", () => {
    const obstacles = generateObstacles(createRng(7), TALL_NARROW, 200);
    expect(obstacles.every((o) => isPassable(o, TALL_NARROW))).toBe(true);
  });

  it("spacing stays within MIN_SPACING and MAX_SPACING at start speed", () => {
    const obstacles = generateObstacles(createRng(3), STANDARD, 50);
    for (let i = 1; i < obstacles.length; i++) {
      const gap = obstacles[i]!.x - obstacles[i - 1]!.x;
      expect(gap).toBeGreaterThanOrEqual(CONFIG.MIN_SPACING);
      expect(gap).toBeLessThanOrEqual(CONFIG.MAX_SPACING);
    }
  });

  it("is deterministic for the same seed", () => {
    const a = generateObstacles(createRng(99), STANDARD, 30);
    const b = generateObstacles(createRng(99), STANDARD, 30);
    expect(a).toEqual(b);
  });

  it("kind weights approximate ground 0.4, overhead 0.35, pinch 0.25", () => {
    const obstacles = generateObstacles(createRng(2026), STANDARD, 4000);
    const count = (k: string) => obstacles.filter((o) => o.kind === k).length / obstacles.length;
    expect(count("ground_gap")).toBeCloseTo(0.4, 1);
    expect(count("overhead")).toBeCloseTo(0.35, 1);
    expect(count("pinch")).toBeCloseTo(0.25, 1);
  });
});
