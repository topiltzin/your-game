import { describe, expect, it } from "vitest";
import { GameRenderer } from "../../src/game/renderer";
import { ParticlePool } from "../../src/game/effects/particles";
import { RunSession } from "../../src/game/run";
import { STANDARD } from "../fixtures/characters";

/** Canvas 2D stand-in that counts every method call. Property writes are accepted and ignored. */
function recordingContext() {
  const calls = new Map<string, number>();
  const ctx = new Proxy({} as Record<string, unknown>, {
    get(target, prop: string) {
      if (prop in target) return target[prop];
      return () => {
        calls.set(prop, (calls.get(prop) ?? 0) + 1);
      };
    },
    set(target, prop: string, value) {
      target[prop] = value;
      return true;
    },
  });
  return { ctx, calls };
}

function renderFrames(reducedMotion: boolean, frames: number) {
  const { ctx, calls } = recordingContext();
  const canvas = { width: 720, height: 1280, getContext: () => ctx } as unknown as HTMLCanvasElement;
  const renderer = new GameRenderer(canvas, { sprite: null, metrics: STANDARD, reducedMotion });
  const session = new RunSession({ seed: 7, metrics: STANDARD });
  session.start();
  const particles = new ParticlePool(20);
  for (let i = 0; i < frames; i++) {
    if (i % 45 === 0) session.jump();
    session.advance(1 / 60);
    renderer.draw(session, particles);
  }
  return { calls, distance: session.distance };
}

describe("game renderer", () => {
  it("draws a running, jumping character for many frames without throwing", () => {
    const { calls, distance } = renderFrames(false, 240);
    expect(distance).toBeGreaterThan(0);
    expect(calls.get("fillRect") ?? 0).toBeGreaterThan(0);
  });

  it("reduced motion draws only the contact shadow as an ellipse (no hills)", () => {
    const { calls } = renderFrames(true, 60);
    expect(calls.get("ellipse")).toBe(60);
  });

  it("full motion adds parallax hills on top of the contact shadow", () => {
    const full = renderFrames(false, 60);
    const reduced = renderFrames(true, 60);
    expect(full.calls.get("ellipse") ?? 0).toBeGreaterThan(reduced.calls.get("ellipse") ?? 0);
  });
});
