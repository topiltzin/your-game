// Tells the player what the next obstacle needs, a moment before it arrives. Pure logic: the run screen draws it.
import type { Intent } from "./input";
import type { Obstacle } from "./obstacles";

/** How many seconds before an obstacle the cue appears. Time-based, so it gives the same warning at any speed. */
export const CUE_SECONDS = 1.3;

export interface ActionCue {
  readonly action: Intent;
  /** 0 when the cue first appears, 1 when the obstacle is on the runner. */
  readonly urgency: number;
}

/**
 * The action the first unpassed obstacle asks for, or null when it is still far away or needs none.
 * A pinch is not cued: the runner always fits through it, so there is nothing to do.
 */
export function nextAction(obstacles: readonly Obstacle[], runnerX: number, speed: number): ActionCue | null {
  const ahead = obstacles
    .filter((o) => o.x + o.width >= runnerX)
    .reduce<Obstacle | null>((first, o) => (first === null || o.x < first.x ? o : first), null);
  if (!ahead || ahead.kind === "pinch") return null;

  const seconds = Math.max(0, ahead.x - runnerX) / Math.max(1, speed);
  if (seconds > CUE_SECONDS) return null;
  return { action: ahead.kind === "ground_gap" ? "jump" : "slide", urgency: 1 - seconds / CUE_SECONDS };
}
