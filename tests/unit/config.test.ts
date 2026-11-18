import { describe, expect, it } from "vitest";
import { CONFIG } from "../../src/game/config";

// Oracle: specs/001-sketch-runner-3d/contracts/game-rules.md, "Constants" table.
describe("game config", () => {
  it("matches the documented tuning constants", () => {
    expect(CONFIG.TICK_HZ).toBe(60);
    expect(CONFIG.GRAVITY).toBe(2600);
    expect(CONFIG.JUMP_VELOCITY).toBe(980);
    expect(CONFIG.SLIDE_DURATION).toBe(0.65);
    expect(CONFIG.SLIDE_HEIGHT_FACTOR).toBe(0.45);
    expect(CONFIG.START_SPEED).toBe(360);
    expect(CONFIG.MAX_SPEED).toBe(820);
    expect(CONFIG.SPEED_RAMP_PER_SECOND).toBe(9);
    expect(CONFIG.CHARACTER_HEIGHT_MIN).toBe(90);
    expect(CONFIG.CHARACTER_HEIGHT_MAX).toBe(260);
    expect(CONFIG.CHARACTER_WIDTH_MIN).toBe(60);
    expect(CONFIG.CHARACTER_WIDTH_MAX).toBe(200);
    expect(CONFIG.CHARACTER_BASE_HEIGHT).toBe(150);
    expect(CONFIG.INPUT_LATENCY_TARGET_MS).toBe(100);
  });

  it("is read-only at runtime", () => {
    expect(Object.isFrozen(CONFIG)).toBe(true);
  });
});
