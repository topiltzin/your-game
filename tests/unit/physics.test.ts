import { describe, expect, it } from "vitest";
import { CONFIG } from "../../src/game/config";
import { createRunner, requestJump, requestSlide, stepRunner } from "../../src/game/physics";

const DT = 1 / CONFIG.TICK_HZ;

function runFor(seconds: number, state: ReturnType<typeof createRunner>) {
  let s = state;
  let landed = false;
  for (let t = 0; t < seconds; t += DT) {
    const r = stepRunner(s, DT);
    s = r.state;
    landed = landed || r.landed;
  }
  return { state: s, landed };
}

describe("runner physics", () => {
  it("jump from standing lands after the airtime implied by gravity and jump velocity", () => {
    const airtime = (2 * CONFIG.JUMP_VELOCITY) / CONFIG.GRAVITY;
    let s = requestJump(createRunner());
    expect(s.mode).toBe("jumping");

    let elapsed = 0;
    let landedAt = -1;
    while (elapsed < airtime + 0.5) {
      const r = stepRunner(s, DT);
      s = r.state;
      elapsed += DT;
      if (r.landed) {
        landedAt = elapsed;
        break;
      }
    }
    expect(landedAt).toBeGreaterThan(0);
    expect(Math.abs(landedAt - airtime)).toBeLessThanOrEqual(2 * DT);
    expect(s.mode).toBe("standing");
    expect(s.y).toBe(0);
  });

  it("jump is rejected while already jumping", () => {
    const jumping = requestJump(createRunner());
    const again = requestJump(jumping);
    expect(again.vy).toBe(jumping.vy);
  });

  it("jump is rejected while sliding and a tap during a slide does not queue a jump", () => {
    let s = requestSlide(createRunner());
    s = requestJump(s);
    expect(s.mode).toBe("sliding");
    const after = runFor(CONFIG.SLIDE_DURATION + 0.2, s);
    expect(after.state.mode).toBe("standing");
    expect(after.state.y).toBe(0);
  });

  it("slide lasts SLIDE_DURATION and then the character stands", () => {
    let s = requestSlide(createRunner());
    expect(s.mode).toBe("sliding");
    const mid = runFor(CONFIG.SLIDE_DURATION / 2, s);
    expect(mid.state.mode).toBe("sliding");
    const end = runFor(CONFIG.SLIDE_DURATION, s);
    expect(end.state.mode).toBe("standing");
  });

  it("slide is rejected while jumping", () => {
    const jumping = requestJump(createRunner());
    expect(requestSlide(jumping).mode).toBe("jumping");
  });
});
