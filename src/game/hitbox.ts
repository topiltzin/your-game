import { CONFIG } from "./config";
import type { CharacterMetrics } from "./character-metrics";
import type { RunnerState } from "./physics";

/** Vertical and horizontal extent of the character, in game units. `top` is measured from the ground. */
export interface Hitbox {
  readonly bottom: number;
  readonly top: number;
  readonly width: number;
}

export function hitboxFor(state: RunnerState, metrics: CharacterMetrics): Hitbox {
  const height =
    state.mode === "sliding"
      ? metrics.heightUnits * CONFIG.SLIDE_HEIGHT_FACTOR
      : metrics.heightUnits;
  return { bottom: state.y, top: state.y + height, width: metrics.widthUnits };
}
