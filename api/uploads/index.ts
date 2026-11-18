// POST /api/uploads: stores one prepared image in private Blob and returns its input key.
// The browser downscales and orients the image first, so the body stays under the 4.5 MB
// function payload limit (contracts/api.md records this).
import { randomUUID } from "node:crypto";
import { createBlobStore } from "../lib/blob";
import { detectImageType } from "../lib/image-check";
import { fail, ok } from "../lib/http";

const MAX_BYTES = 10 * 1024 * 1024;
const EXTENSION = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" } as const;

export async function POST(request: Request): Promise<Response> {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail("VALIDATION");
  }
  const file = form.get("image");
  if (!(file instanceof File)) return fail("VALIDATION");
  if (file.size > MAX_BYTES) return fail("IMAGE_TOO_LARGE");

  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = detectImageType(bytes);
  if (!type) return fail("IMAGE_INVALID");

  const inputKey = `inputs/${randomUUID()}.${EXTENSION[type]}`;
  await createBlobStore().putPrivate(inputKey, bytes, type);
  return ok({ inputKey }, 201);
}
