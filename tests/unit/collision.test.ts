import { describe, expect, it } from "vitest";
import { createRunner, requestSlide } from "../../src/game/physics";
import { collides } from "../../src/game/collision";
import type { Obstacle } from "../../src/game/obstacles";
import { SHORT_WIDE, STANDARD, TALL_NARROW } from "../fixtures/characters";

const OVERHEAD: Obstacle = { kind: "overhead", x: 0, width: 80, clearance: 200 };
const PINCH: Obstacle = { kind: "pinch", x: 0, width: 80, gapWidth: 150 };
const GROUND: Obstacle = { kind: "ground_gap", x: 0, width: 120 };
const RUNNER_OVER = 40; // runner's x is inside the obstacle span for every test below

const standing = createRunner();
const sliding = requestSlide(createRunner());

describe("collision rules (oracle from game-rules.md)", () => {
  it("standing character with height at or below clearance passes an overhead barrier", () => {
    expect(collides(standing, STANDARD, OVERHEAD, RUNNER_OVER)).toBe(false);
    expect(collides(standing, SHORT_WIDE, OVERHEAD, RUNNER_OVER)).toBe(false);
  });

  it("standing character taller than clearance crashes on an overhead barrier", () => {
    expect(collides(standing, TALL_NARROW, OVERHEAD, RUNNER_OVER)).toBe(true);
  });

  it("sliding character passes where a taller standing character cannot", () => {
    expect(collides(standing, TALL_NARROW, OVERHEAD, RUNNER_OVER)).toBe(true);
    expect(collides(sliding, TALL_NARROW, OVERHEAD, RUNNER_OVER)).toBe(false);
  });

  it("wider than the pinch gap crashes; at or narrower passes", () => {
    expect(collides(standing, SHORT_WIDE, PINCH, RUNNER_OVER)).toBe(true);
    expect(collides(standing, TALL_NARROW, PINCH, RUNNER_OVER)).toBe(false);
    expect(collides(standing, STANDARD, PINCH, RUNNER_OVER)).toBe(false);
  });

  it("ground gap crashes when the character is on the ground and clears when airborne", () => {
    expect(collides(standing, STANDARD, GROUND, RUNNER_OVER)).toBe(true);
  });

  it("nothing collides when the runner is outside the obstacle span", () => {
    expect(collides(standing, TALL_NARROW, OVERHEAD, 500)).toBe(false);
  });
});
