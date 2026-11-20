import { describe, expect, it } from "vitest";
import { findShotTarget } from "../../src/game/shots";
import type { Obstacle } from "../../src/game/obstacles";

const pillar: Obstacle = { kind: "pinch", x: 500, width: 80, gapWidth: 140 };
const bar: Obstacle = { kind: "overhead", x: 900, width: 100, clearance: 160 };
const gap: Obstacle = { kind: "ground_gap", x: 1300, width: 120 };

describe("findShotTarget", () => {
  it("hits a pillar the shot is inside", () => {
    expect(findShotTarget(540, [pillar, bar, gap])).toBe(pillar);
  });

  it("hits an overhead bar the shot is inside", () => {
    expect(findShotTarget(950, [pillar, bar, gap])).toBe(bar);
  });

  it("never targets a ground gap, so a gap can only be cleared by jumping", () => {
    expect(findShotTarget(1350, [pillar, bar, gap])).toBeNull();
  });

  it("misses when the shot is not inside any obstacle", () => {
    expect(findShotTarget(700, [pillar, bar, gap])).toBeNull();
  });
});
