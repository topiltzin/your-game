import { describe, expect, it } from "vitest";
import { CONFIG } from "../../src/game/config";
import { RunSession, type RunEvent } from "../../src/game/run";
import { STANDARD } from "../fixtures/characters";

const DT = 1 / CONFIG.TICK_HZ;

/** Runs a hands-off session tick by tick until it ends, recording every event with its time. */
function runUntrained(seed: number): { events: { type: string; at: number }[]; run: RunSession } {
  const events: { type: string; at: number }[] = [];
  let t = 0;
  const run = new RunSession({ seed, metrics: STANDARD, onEvent: (e: RunEvent) => events.push({ type: e.type, at: t }) });
  run.start();
  for (let i = 0; i < 60 * 120 && run.state === "running"; i++) {
    t += DT;
    run.advance(DT);
  }
  return { events, run };
}

describe("lives", () => {
  it("starts with the configured number of lives", () => {
    const run = new RunSession({ seed: 1, metrics: STANDARD });
    expect(run.lives).toBe(CONFIG.LIVES);
  });

  it("survives hits until the lives run out, then ends with one crash", () => {
    const { events, run } = runUntrained(5);
    const hits = events.filter((e) => e.type === "hit").length;
    expect(hits).toBe(CONFIG.LIVES - 1);
    expect(events.filter((e) => e.type === "crash")).toHaveLength(1);
    expect(run.state).toBe("ended");
    expect(run.lives).toBe(0);
  });

  it("gives a protected moment after a hit, so one obstacle never costs two lives", () => {
    const { events } = runUntrained(5);
    const hurt = events.filter((e) => e.type === "hit" || e.type === "crash");
    for (let i = 1; i < hurt.length; i++) {
      expect(hurt[i]!.at - hurt[i - 1]!.at).toBeGreaterThanOrEqual(CONFIG.INVULN_SECONDS);
    }
  });

  it("reports the protected state while it lasts", () => {
    let hit = false;
    const run = new RunSession({ seed: 5, metrics: STANDARD, onEvent: (e) => { if (e.type === "hit") hit = true; } });
    run.start();
    for (let i = 0; i < 60 * 60 && !hit; i++) run.advance(DT);
    expect(run.invulnerable).toBe(true);
    run.advance(CONFIG.INVULN_SECONDS + 0.1);
    expect(run.invulnerable).toBe(false);
  });
});

describe("jump buffer", () => {
  it("a jump pressed just before landing fires on landing", () => {
    const run = new RunSession({ seed: 1, metrics: STANDARD });
    run.start();
    run.jump();
    let guard = 0;
    while (!(run.runnerState.vy < 0 && run.runnerState.y < 30) && guard++ < 600) run.advance(DT);
    run.jump(); // too early to take: the runner is still in the air
    let landed = false;
    guard = 0;
    while (!landed && guard++ < 600) {
      run.advance(DT);
      landed = run.runnerState.mode !== "jumping" || run.runnerState.vy > 0;
    }
    expect(run.runnerState.mode).toBe("jumping");
  });

  it("a jump pressed long before landing is forgotten", () => {
    const run = new RunSession({ seed: 1, metrics: STANDARD });
    run.start();
    run.jump();
    run.advance(DT * 3);
    run.jump(); // right after take off, the landing is far away
    let guard = 0;
    while (run.runnerState.mode === "jumping" && guard++ < 600) run.advance(DT);
    expect(run.runnerState.mode).toBe("standing");
  });
});
