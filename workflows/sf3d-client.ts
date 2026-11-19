// Client for the external image-to-3D service (same service emi_crafting uses; endpoint from SF3D_API_URL).
// Sends multipart fields `image` and `texture_resolution`, receives the model file as the body.
// Errors carry fixed, sanitized messages: upstream bodies are never copied into logs or the database.

export class ExternalServiceError extends Error {
  readonly retryable: boolean;

  constructor(message: string, options: { retryable: boolean }) {
    super(message);
    this.name = "ExternalServiceError";
    this.retryable = options.retryable;
  }
}

export interface Sf3dOptions {
  readonly endpoint: string;
  /** Upper bound for this single call; the caller passes the time left before the job deadline. */
  readonly timeoutMs: number;
  readonly fetch?: typeof fetch;
}

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

export async function callImageTo3d(image: Uint8Array, textureResolution: 512 | 1024, options: Sf3dOptions): Promise<Uint8Array> {
  const doFetch = options.fetch ?? fetch;
  const form = new FormData();
  const copy = new Uint8Array(image.byteLength);
  copy.set(image);
  form.append("image", new Blob([copy], { type: "image/jpeg" }), "input.jpg");
  form.append("texture_resolution", String(textureResolution));

  let response: Response;
  try {
    response = await doFetch(options.endpoint, {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(Math.max(1, options.timeoutMs)),
    });
  } catch (error) {
    if (isAbort(error)) throw new ExternalServiceError("3D service timed out", { retryable: false });
    throw new ExternalServiceError("3D service unreachable", { retryable: true });
  }

  if (!response.ok) {
    throw new ExternalServiceError(`3D service responded with ${response.status}`, {
      retryable: RETRYABLE_STATUS.has(response.status),
    });
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  // A 200 with an empty or JSON body is not a model. Storing it made a "ready" job with no image.
  // Same check as emi_crafting's sf3d.py (GLB_MAGIC).
  if (!startsWithGlbMagic(bytes)) {
    throw new ExternalServiceError("3D service returned no model", { retryable: false });
  }
  return bytes;
}

const GLB_MAGIC = [0x67, 0x6c, 0x54, 0x46]; // "glTF"

function startsWithGlbMagic(bytes: Uint8Array): boolean {
  return GLB_MAGIC.every((byte, index) => bytes[index] === byte);
}

function isAbort(error: unknown): boolean {
  return error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError");
}
