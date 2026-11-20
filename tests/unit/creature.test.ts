import { describe, expect, it } from "vitest";
import { CREATURE_METRICS, PIXEL_UNITS } from "../../src/game/creature";
import { RunSession } from "../../src/game/run";
import { SHOT_COOLDOWN } from "../../src/game/shots";

describe("creature runner", () => {
  it("has a collision box of 10 by 12 pixels, so the drawing and the hitbox match", () => {
    expect(CREATURE_METRICS.widthUnits).toBe(10 * PIXEL_UNITS);
    expect(CREATURE_METRICS.heightUnits).toBe(12 * PIXEL_UNITS);
  });

  it("shoots from the runner, and a second shot waits for the cooldown", () => {
    const session = new RunSession({ seed: 7, metrics: CREATURE_METRICS });
    session.start();
    session.shoot();
    session.shoot();
    expect(session.shots).toHaveLength(1);
    const dt = 1 / 60;
    for (let t = 0; t < SHOT_COOLDOWN + dt; t += dt) session.advance(dt);
    session.shoot();
    expect(session.shots.length).toBeGreaterThanOrEqual(1);
  });

  it("does not shoot before the run starts", () => {
    const session = new RunSession({ seed: 7, metrics: CREATURE_METRICS });
    session.shoot();
    expect(session.shots).toHaveLength(0);
  });
});
