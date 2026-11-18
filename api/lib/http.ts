import { ERROR_TABLE, errorBody, type ErrorCode } from "./errors";

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };

export function ok(data: unknown, status = 200): Response {
  return new Response(JSON.stringify({ ok: true, data, error: null }), { status, headers: JSON_HEADERS });
}

export function fail(code: ErrorCode): Response {
  return new Response(JSON.stringify(errorBody(code)), { status: ERROR_TABLE[code].status, headers: JSON_HEADERS });
}

/** Last path segment of a route like /api/jobs/{id}. Avoids depending on framework-specific params. */
export function lastSegment(request: Request): string {
  return new URL(request.url).pathname.split("/").filter(Boolean).at(-1) ?? "";
}

export function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization") ?? "";
  return header.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}
