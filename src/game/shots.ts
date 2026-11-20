// Shooting rules, kept pure so they can be tested without the DOM.
// A shot flies forward from the creature and clears the first pillar or overhead bar it reaches.
// Ground gaps cannot be shot: they are holes, so the only answer to them is a jump.
import type { Obstacle } from "./obstacles";

export interface Shot {
  readonly x: number;
}

export const SHOT_SPEED = 1400; // world units per second
export const SHOT_COOLDOWN = 0.35; // seconds between shots
export const SHOT_OFFSET = 70; // world units ahead of the runner's position where a shot starts
export const SHOT_RANGE = 1800; // world units ahead of the runner before a shot is discarded

/** The first obstacle a shot at `shotX` is inside, or null. Ground gaps are never targets. */
export function findShotTarget(shotX: number, obstacles: readonly Obstacle[]): Obstacle | null {
  for (const obstacle of obstacles) {
    if (obstacle.kind === "ground_gap") continue;
    if (shotX >= obstacle.x && shotX <= obstacle.x + obstacle.width) return obstacle;
  }
  return null;
}
