// GET /api/models/{blob key}?exp=&sig=: serves a private model file after verifying its signed URL.
import { createBlobStore } from "../../server/lib/blob";
import { fail } from "../../server/lib/http";
import { verifyModelUrl } from "../../server/lib/signed-model-url";
import { MODEL_URL_SECRET } from "../../server/lib/services";

export async function GET(request: Request): Promise<Response> {
  const key = verifyModelUrl(new URL(request.url), { secret: MODEL_URL_SECRET(), now: new Date() });
  if (!key) return fail("JOB_NOT_FOUND");
  const bytes = await createBlobStore().getPrivate(key);
  if (!bytes) return fail("JOB_NOT_FOUND");
  return new Response(Buffer.from(bytes), {
    status: 200,
    headers: { "content-type": "model/gltf-binary", "cache-control": "private, max-age=900" },
  });
}
