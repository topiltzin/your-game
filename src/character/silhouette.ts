// Silhouette extraction from RGBA pixels (game-rules.md "Character metrics from silhouette").
// Pure: operates on a pixel buffer, so it runs in tests without a canvas.

export interface Silhouette {
  readonly width: number;
  readonly height: number;
  readonly area: number;
  /** 1 where a kept foreground pixel is, 0 elsewhere. Same size as the input image. */
  readonly mask: Uint8Array;
}

const ALPHA_MIN = 0.5 * 255;
const LUMINANCE_MAX = 0.9 * 255;
const MIN_FOREGROUND_PIXELS = 500;
/** Components smaller than this fraction of the largest one are specks and dropped. */
const MIN_COMPONENT_RATIO = 0.02;

/** Returns null when the image has too little drawing to make a character (CHARACTER_UNREADABLE). */
export function extractSilhouette(rgba: Uint8ClampedArray, width: number, height: number): Silhouette | null {
  const foreground = foregroundMask(rgba, width, height);
  if (countOnes(foreground) < MIN_FOREGROUND_PIXELS) return null;

  const components = labelComponents(foreground, width, height);
  const largest = Math.max(...components.map((c) => c.area));
  const kept = components.filter((c) => c.area >= largest * MIN_COMPONENT_RATIO);

  const mask = new Uint8Array(width * height);
  for (const component of kept) for (const index of component.pixels) mask[index] = 1;

  const box = boundingBox(kept);
  return { width: box.width, height: box.height, area: kept.reduce((n, c) => n + c.area, 0), mask };
}

function foregroundMask(rgba: Uint8ClampedArray, width: number, height: number): Uint8Array {
  const mask = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const p = i * 4;
    const alpha = rgba[p + 3] ?? 0;
    const luminance = 0.2126 * (rgba[p] ?? 0) + 0.7152 * (rgba[p + 1] ?? 0) + 0.0722 * (rgba[p + 2] ?? 0);
    mask[i] = alpha > ALPHA_MIN && luminance < LUMINANCE_MAX ? 1 : 0;
  }
  return mask;
}

interface Component {
  area: number;
  pixels: number[];
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

// 8-connected flood fill, iterative so large drawings cannot overflow the call stack.
function labelComponents(mask: Uint8Array, width: number, height: number): Component[] {
  const seen = new Uint8Array(width * height);
  const components: Component[] = [];
  const stack: number[] = [];

  for (let start = 0; start < mask.length; start++) {
    if (mask[start] !== 1 || seen[start] === 1) continue;
    const component: Component = { area: 0, pixels: [], minX: width, minY: height, maxX: 0, maxY: 0 };
    seen[start] = 1;
    stack.push(start);
    while (stack.length > 0) {
      const index = stack.pop()!;
      addPixel(component, index, width);
      visitNeighbours(index, width, height, (n) => {
        if (mask[n] === 1 && seen[n] !== 1) {
          seen[n] = 1;
          stack.push(n);
        }
      });
    }
    components.push(component);
  }
  return components;
}

function addPixel(component: Component, index: number, width: number): void {
  const x = index % width;
  const y = Math.floor(index / width);
  component.pixels.push(index);
  component.area++;
  component.minX = Math.min(component.minX, x);
  component.maxX = Math.max(component.maxX, x);
  component.minY = Math.min(component.minY, y);
  component.maxY = Math.max(component.maxY, y);
}

function visitNeighbours(index: number, width: number, height: number, visit: (n: number) => void): void {
  const x = index % width;
  const y = Math.floor(index / width);
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < width && ny < height) visit(ny * width + nx);
    }
  }
}

function boundingBox(components: Component[]): { width: number; height: number } {
  const minX = Math.min(...components.map((c) => c.minX));
  const maxX = Math.max(...components.map((c) => c.maxX));
  const minY = Math.min(...components.map((c) => c.minY));
  const maxY = Math.max(...components.map((c) => c.maxY));
  return { width: maxX - minX + 1, height: maxY - minY + 1 };
}

function countOnes(mask: Uint8Array): number {
  let n = 0;
  for (const v of mask) n += v;
  return n;
}
