import { CONFIG } from "./config";
import type { CharacterMetrics } from "./character-metrics";
import type { Rng } from "./rng";

export type Obstacle =
  | { kind: "ground_gap"; x: number; width: number }
  | { kind: "overhead"; x: number; width: number; clearance: number }
  | { kind: "pinch"; x: number; width: number; gapWidth: number };

// Kind weights from game-rules.md "Generator": ground 0.4, overhead 0.35, pinch 0.25.
const GROUND_WEIGHT = 0.4;
const OVERHEAD_WEIGHT = 0.35;

/** Whether this character can get past the obstacle at all (standing, sliding, or jumping). */
export function isPassable(obstacle: Obstacle, metrics: CharacterMetrics): boolean {
  if (obstacle.kind === "ground_gap") return true;
  if (obstacle.kind === "overhead") {
    return metrics.heightUnits * CONFIG.SLIDE_HEIGHT_FACTOR <= obstacle.clearance;
  }
  return metrics.widthUnits <= obstacle.gapWidth;
}

/**
 * Generates `count` obstacles from `startX`. Any candidate the character cannot pass is
 * replaced by a ground gap, which is always passable, so two impassable obstacles never
 * sit next to each other.
 */
export function generateObstacles(
  rng: Rng,
  metrics: CharacterMetrics,
  count: number,
  startX: number = CONFIG.FIRST_OBSTACLE_X,
): Obstacle[] {
  const obstacles: Obstacle[] = [];
  let x = startX;
  for (let i = 0; i < count; i++) {
    const candidate = candidateAt(rng, x);
    obstacles.push(isPassable(candidate, metrics) ? candidate : groundGapAt(rng, x));
    x += CONFIG.MIN_SPACING + rng.next() * (CONFIG.MAX_SPACING - CONFIG.MIN_SPACING);
  }
  return obstacles;
}

function candidateAt(rng: Rng, x: number): Obstacle {
  const roll = rng.next();
  if (roll < GROUND_WEIGHT) return groundGapAt(rng, x);
  if (roll < GROUND_WEIGHT + OVERHEAD_WEIGHT) {
    return { kind: "overhead", x, width: 80 + rng.next() * 60, clearance: 130 + rng.next() * 90 };
  }
  return { kind: "pinch", x, width: 80, gapWidth: 110 + rng.next() * 60 };
}

function groundGapAt(rng: Rng, x: number): Obstacle {
  return { kind: "ground_gap", x, width: 80 + rng.next() * 100 };
}
