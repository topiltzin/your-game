import { describe, expect, it } from "vitest";
import { COIN_ARC_HEIGHT, coinsFor, collectCoins } from "../../src/game/coins";
import type { Obstacle } from "../../src/game/obstacles";

const gap: Obstacle = { kind: "ground_gap", x: 1000, width: 120 };
const bar: Obstacle = { kind: "overhead", x: 1000, width: 100, clearance: 160 };

describe("coins", () => {
  it("puts a three-coin arc above a gap, centred on it", () => {
    const coins = coinsFor(gap, 0);
    expect(coins).toHaveLength(3);
    expect(coins.every((c) => c.y === COIN_ARC_HEIGHT)).toBe(true);
    expect(coins[1]!.x).toBe(1060);
  });

  it("places no coins over an overhead bar, which is passed by sliding", () => {
    expect(coinsFor(bar, 0)).toEqual([]);
  });

  it("skips the arc when the roll misses", () => {
    expect(coinsFor(gap, 0.99)).toEqual([]);
  });

  it("collects a coin the runner touches and keeps the rest", () => {
    const coins = [
      { x: 1000, y: 150 },
      { x: 1400, y: 150 },
    ];
    const result = collectCoins(coins, 1010, 150);
    expect(result.collected).toBe(1);
    expect(result.remaining).toEqual([{ x: 1400, y: 150 }]);
  });

  it("does not collect a coin the runner is too far from, horizontally or vertically", () => {
    expect(collectCoins([{ x: 1000, y: 150 }], 1200, 150).collected).toBe(0);
    expect(collectCoins([{ x: 1000, y: 150 }], 1000, 400).collected).toBe(0);
  });
});
