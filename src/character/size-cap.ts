import { CONFIG } from "../game/config";
import type { CharacterMetrics } from "../game/character-metrics";

export interface CappedMetrics {
  readonly metrics: CharacterMetrics;
  /** True when the drawing had to be scaled to fit the size limits (FR-021). */
  readonly sizeCapped: boolean;
}

/**
 * Normalizes a drawing's bounding box to game units. Height starts at CHARACTER_BASE_HEIGHT and
 * width keeps the drawing's aspect ratio. The scale is limited so the height stays within
 * [HEIGHT_MIN, HEIGHT_MAX] and the width within [WIDTH_MIN, WIDTH_MAX]. If both cannot hold,
 * the width maximum wins, which keeps very wide drawings from covering pinch gaps.
 */
export function toCharacterMetrics(box: { width: number; height: number }): CappedMetrics {
  const naturalWidth = (box.width * CONFIG.CHARACTER_BASE_HEIGHT) / box.height;
  const lowest = Math.max(CONFIG.CHARACTER_HEIGHT_MIN / CONFIG.CHARACTER_BASE_HEIGHT, CONFIG.CHARACTER_WIDTH_MIN / naturalWidth);
  const highest = Math.min(CONFIG.CHARACTER_HEIGHT_MAX / CONFIG.CHARACTER_BASE_HEIGHT, CONFIG.CHARACTER_WIDTH_MAX / naturalWidth);
  const scale = Math.min(Math.max(1, lowest), highest);

  return {
    metrics: {
      heightUnits: CONFIG.CHARACTER_BASE_HEIGHT * scale,
      widthUnits: naturalWidth * scale,
    },
    sizeCapped: Math.abs(scale - 1) > 1e-9,
  };
}
