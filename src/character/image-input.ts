// Client-side image handling: validation, HEIC decoding (lazy), and downscaling before upload.
import type { ErrorCode } from "../../server/lib/errors";

const ACCEPTED = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);
const MAX_BYTES = 10 * 1024 * 1024;
/** Longest side sent to the server; keeps the upload under the 4.5 MB function body limit. */
export const UPLOAD_MAX_SIDE = 1024;

export function validateImageFile(file: { type: string; size: number }): ErrorCode | null {
  if (!ACCEPTED.has(file.type)) return "IMAGE_TYPE_UNSUPPORTED";
  if (file.size > MAX_BYTES) return "IMAGE_TOO_LARGE";
  return null;
}

/** Decodes HEIC/HEIF to JPEG. The decoder is loaded only when such a file is chosen. */
async function decodeHeic(file: Blob): Promise<Blob> {
  const { heicTo } = await import("heic-to");
  return heicTo({ blob: file, type: "image/jpeg", quality: 0.92 });
}

/** Loads the picked file as an ImageBitmap, decoding HEIC first when needed. */
export async function loadBitmap(file: File): Promise<ImageBitmap> {
  const source = file.type === "image/heic" || file.type === "image/heif" ? await decodeHeic(file) : file;
  return createImageBitmap(source);
}

/** Draws the image onto a canvas at most UPLOAD_MAX_SIDE on its longest side. */
export function fitToCanvas(source: CanvasImageSource, width: number, height: number): HTMLCanvasElement {
  const scale = Math.min(1, UPLOAD_MAX_SIDE / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("canvas unavailable");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export function canvasToJpeg(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("encode failed"))), "image/jpeg", 0.9);
  });
}
