import { CONFIG } from "./config";
import type { CharacterMetrics } from "./character-metrics";
import { hitboxFor } from "./hitbox";
import type { Obstacle } from "./obstacles";
import type { RunnerState } from "./physics";

/**
 * True when the character hits the obstacle. `runnerX` is the runner's position in the
 * same coordinate space as the obstacle. Rules: game-rules.md "Obstacle rules".
 *
 * - overhead: crash when the top of the character is above the barrier clearance (FR-016)
 * - pinch: crash when the character is wider than the gap (FR-017)
 * - ground gap: crash when the character is too low to clear it
 */
export function collides(
  runner: RunnerState,
  metrics: CharacterMetrics,
  obstacle: Obstacle,
  runnerX: number,
): boolean {
  const overlapsX = runnerX >= obstacle.x && runnerX <= obstacle.x + obstacle.width;
  if (!overlapsX) return false;

  if (obstacle.kind === "overhead") {
    return hitboxFor(runner, metrics).top > obstacle.clearance;
  }
  if (obstacle.kind === "pinch") {
    return metrics.widthUnits > obstacle.gapWidth;
  }
  return runner.y < CONFIG.CLEAR_HEIGHT;
}
