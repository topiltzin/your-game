import { describe, expect, it } from "vitest";
import { nextAction, CUE_SECONDS } from "../../src/game/action-cue";
import type { Obstacle } from "../../src/game/obstacles";

const pit: Obstacle = { kind: "ground_gap", x: 1000, width: 100 };
const bar: Obstacle = { kind: "overhead", x: 1000, width: 100, clearance: 150 };
const pinch: Obstacle = { kind: "pinch", x: 1000, width: 80, gapWidth: 140 };
const SPEED = 500;

describe("nextAction", () => {
  it("says jump for a pit that is close", () => {
    const cue = nextAction([pit], 1000 - SPEED * 0.5, SPEED);
    expect(cue?.action).toBe("jump");
  });

  it("says slide for an overhead bar that is close", () => {
    expect(nextAction([bar], 1000 - SPEED * 0.5, SPEED)?.action).toBe("slide");
  });

  it("stays quiet while the obstacle is still far away", () => {
    expect(nextAction([pit], 1000 - SPEED * (CUE_SECONDS + 0.5), SPEED)).toBeNull();
  });

  it("stays quiet for a pinch, which needs no action", () => {
    expect(nextAction([pinch], 900, SPEED)).toBeNull();
  });

  it("keeps the cue while the runner is inside the obstacle", () => {
    expect(nextAction([pit], 1050, SPEED)?.action).toBe("jump");
  });

  it("ignores obstacles already behind the runner", () => {
    expect(nextAction([pit], 1200, SPEED)).toBeNull();
  });

  it("looks at the first obstacle ahead, not a later one", () => {
    const later: Obstacle = { kind: "overhead", x: 1300, width: 100, clearance: 150 };
    expect(nextAction([later, pit], 800, SPEED)?.action).toBe("jump");
  });

  it("is more urgent the closer the obstacle gets", () => {
    const far = nextAction([pit], 1000 - SPEED * 1.0, SPEED)!;
    const near = nextAction([pit], 1000 - SPEED * 0.2, SPEED)!;
    expect(near.urgency).toBeGreaterThan(far.urgency);
    expect(near.urgency).toBeLessThanOrEqual(1);
    expect(far.urgency).toBeGreaterThanOrEqual(0);
  });
});
