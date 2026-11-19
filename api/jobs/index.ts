// POST /api/jobs: creates a 3D job for an uploaded input and returns the one-time access token.
import { clientIp, createJobServiceForRequest } from "../../server/lib/services.js";
import { fail, ok, readJson } from "../../server/lib/http.js";

const INPUT_KEY = /^inputs\/[0-9a-f-]{36}\.(jpg|png|webp)$/;

export async function POST(request: Request): Promise<Response> {
  const body = (await readJson(request)) as Record<string, unknown> | undefined;
  if (!body || typeof body["inputKey"] !== "string" || !INPUT_KEY.test(body["inputKey"])) {
    return fail("VALIDATION");
  }
  const resolution = body["textureResolution"];
  if (resolution !== 512 && resolution !== 1024) return fail("VALIDATION");

  const service = createJobServiceForRequest(clientIp(request), new URL(request.url).origin);
  const result = await service.createJob({
    inputKey: body["inputKey"],
    textureResolution: resolution,
    disclosureAccepted: body["disclosureAccepted"] === true,
  });
  if (!result.ok) return fail(result.code);
  return ok({ job: result.job, accessToken: result.accessToken }, 201);
}
