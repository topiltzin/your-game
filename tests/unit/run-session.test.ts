import { describe, expect, it } from "vitest";
import { CONFIG } from "../../src/game/config";
import { RunSession, milestonesCrossed, speedAt } from "../../src/game/run";
import { STANDARD } from "../fixtures/characters";

describe("run session", () => {
  it("auto-runs: distance grows with no input before the first obstacle (acceptance 2.1)", () => {
    const run = new RunSession({ seed: 1, metrics: STANDARD });
    run.start();
    run.advance(0.5);
    expect(run.distance).toBeGreaterThan(0);
    expect(run.state).toBe("running");
  });

  it("pause preserves distance across a simulated 10 s hidden period (oracle 9)", () => {
    const run = new RunSession({ seed: 1, metrics: STANDARD });
    run.start();
    run.advance(0.2);
    run.pause();
    const before = run.distance;
    run.advance(10);
    expect(run.distance).toBe(before);
    run.resume();
    run.advance(0.1);
    expect(run.distance).toBeGreaterThan(before);
  });

  it("advances in whole fixed ticks at TICK_HZ", () => {
    const run = new RunSession({ seed: 1, metrics: STANDARD });
    run.start();
    run.advance(1 / CONFIG.TICK_HZ / 2);
    expect(run.ticks).toBe(0);
    run.advance(1 / CONFIG.TICK_HZ / 2);
    expect(run.ticks).toBe(1);
  });

  it("ramps speed gradually and caps it at MAX_SPEED (FR-018)", () => {
    expect(speedAt(0)).toBe(CONFIG.START_SPEED);
    expect(speedAt(1)).toBe(CONFIG.START_SPEED + CONFIG.SPEED_RAMP_PER_SECOND);
    expect(speedAt(10_000)).toBe(CONFIG.MAX_SPEED);
  });

  it("the session's speed increases while it runs", () => {
    const run = new RunSession({ seed: 1, metrics: STANDARD });
    run.start();
    run.advance(0.5);
    expect(run.speed).toBeGreaterThan(CONFIG.START_SPEED);
  });

  it("counts one milestone per 500 units crossed", () => {
    expect(milestonesCrossed(490, 510)).toBe(1);
    expect(milestonesCrossed(0, 499)).toBe(0);
    expect(milestonesCrossed(400, 1100)).toBe(2);
  });

  it("emits a crash event and ends the run when the character hits an obstacle", () => {
    const events: string[] = [];
    const run = new RunSession({ seed: 5, metrics: STANDARD, onEvent: (e) => events.push(e.type) });
    run.start();
    run.advance(10);
    expect(run.state).toBe("ended");
    expect(events.at(-1)).toBe("crash");
  });
});
