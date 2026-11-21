// Turns a sketch or preset picture into a runner sprite: the paper background becomes transparent,
// but white *inside* the character (eye whites, a blank belly) stays solid, and a white sticker
// outline keeps the character readable on any ground colour.

/** Channel value above which a pixel counts as paper (out of 255). */
export const PAPER_THRESHOLD = 225;
/** Sticker outline width as a fraction of the picture's longer side. */
const OUTLINE_FRACTION = 0.018;
const OUTLINE_STEPS = 16;
const MIN_OUTLINE_PX = 2;
const TRANSPARENT_BELOW = 16;

function isPaper(data: Uint8ClampedArray, index: number): boolean {
  return (
    data[index + 3]! < TRANSPARENT_BELOW ||
    (data[index]! > PAPER_THRESHOLD && data[index + 1]! > PAPER_THRESHOLD && data[index + 2]! > PAPER_THRESHOLD)
  );
}

/**
 * Makes the paper that touches the picture's edge transparent (flood fill from the border).
 * Paper enclosed by the character is left alone. Mutates `data` and returns it.
 */
export function removeBackground(data: Uint8ClampedArray, width: number, height: number): Uint8ClampedArray {
  const seen = new Uint8Array(width * height);
  const stack: number[] = [];
  const push = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const cell = y * width + x;
    if (seen[cell] || !isPaper(data, cell * 4)) return;
    seen[cell] = 1;
    stack.push(cell);
  };
  for (let x = 0; x < width; x++) {
    push(x, 0);
    push(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    push(0, y);
    push(width - 1, y);
  }
  while (stack.length > 0) {
    const cell = stack.pop()!;
    data[cell * 4 + 3] = 0;
    const x = cell % width;
    const y = (cell - x) / width;
    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }
  return data;
}

/** Builds the sprite canvas: background removed, white sticker outline around the character. */
export function buildSpriteCanvas(image: HTMLImageElement): HTMLCanvasElement | null {
  const width = image.naturalWidth;
  const height = image.naturalHeight;
  if (width === 0 || height === 0) return null;

  const source = document.createElement("canvas");
  source.width = width;
  source.height = height;
  const sourceCtx = source.getContext("2d");
  if (!sourceCtx) return null;
  sourceCtx.drawImage(image, 0, 0);
  const pixels = sourceCtx.getImageData(0, 0, width, height);
  removeBackground(pixels.data, width, height);
  sourceCtx.putImageData(pixels, 0, 0);

  const pad = Math.max(MIN_OUTLINE_PX, Math.round(Math.max(width, height) * OUTLINE_FRACTION));
  const out = document.createElement("canvas");
  out.width = width + pad * 2;
  out.height = height + pad * 2;
  const ctx = out.getContext("2d");
  if (!ctx) return null;

  // A white copy of the silhouette, stamped around the character to form the outline.
  const silhouette = document.createElement("canvas");
  silhouette.width = width;
  silhouette.height = height;
  const silhouetteCtx = silhouette.getContext("2d")!;
  silhouetteCtx.drawImage(source, 0, 0);
  silhouetteCtx.globalCompositeOperation = "source-in";
  silhouetteCtx.fillStyle = "#ffffff";
  silhouetteCtx.fillRect(0, 0, width, height);

  for (let i = 0; i < OUTLINE_STEPS; i++) {
    const angle = (i / OUTLINE_STEPS) * Math.PI * 2;
    ctx.drawImage(silhouette, pad + Math.cos(angle) * pad, pad + Math.sin(angle) * pad);
  }
  ctx.drawImage(source, pad, pad);
  return out;
}
