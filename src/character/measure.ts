// Browser glue: reads pixels from a drawing and turns its silhouette into game metrics.
import { extractSilhouette } from "./silhouette";
import { toCharacterMetrics, type CappedMetrics } from "./size-cap";

const MEASURE_SIDE = 256;

/** Null when the drawing has no readable character (CHARACTER_UNREADABLE). */
export function measureCharacter(source: HTMLCanvasElement): CappedMetrics | null {
  const scale = Math.min(1, MEASURE_SIDE / Math.max(source.width, source.height));
  const small = document.createElement("canvas");
  small.width = Math.max(1, Math.round(source.width * scale));
  small.height = Math.max(1, Math.round(source.height * scale));
  const ctx = small.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(source, 0, 0, small.width, small.height);

  const pixels = ctx.getImageData(0, 0, small.width, small.height);
  const silhouette = extractSilhouette(pixels.data, small.width, small.height);
  if (!silhouette) return null;
  return toCharacterMetrics({ width: silhouette.width, height: silhouette.height });
}
