// GET /api/jobs/{id}: poll status (lazy timeout included). DELETE /api/jobs/{id}: cancel.
// Both need the bearer token from creation. A wrong token gets the same answer as a missing job.
import { createJobServiceForRequest, clientIp } from "../../server/lib/services.js";
import { bearerToken, fail, lastSegment, ok } from "../../server/lib/http.js";

export async function GET(request: Request): Promise<Response> {
  const token = bearerToken(request);
  if (!token) return fail("JOB_NOT_FOUND");
  const service = createJobServiceForRequest(clientIp(request), new URL(request.url).origin);
  const result = await service.getJob(lastSegment(request), token);
  if (!result.ok) return fail(result.code);
  return ok(result.data);
}

export async function DELETE(request: Request): Promise<Response> {
  const token = bearerToken(request);
  if (!token) return fail("JOB_NOT_FOUND");
  const service = createJobServiceForRequest(clientIp(request), new URL(request.url).origin);
  const result = await service.cancelJob(lastSegment(request), token);
  if (!result.ok) return fail(result.code);
  return ok(result.data);
}
