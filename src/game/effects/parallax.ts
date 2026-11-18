/**
 * Horizontal offset of each background layer. Each layer scrolls at its own fraction of the run
 * distance and wraps at `width`, so far layers move slower than near ones.
 */
export function parallaxOffsets(distance: number, width: number, factors: readonly number[]): number[] {
  return factors.map((factor) => {
    const raw = (distance * factor) % width;
    return raw < 0 ? raw + width : raw;
  });
}
