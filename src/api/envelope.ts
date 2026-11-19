// Parses the { ok, data, error } envelope from contracts/api.md. Anything that is not an envelope
// is treated as an internal error, so a proxy's HTML page never leaks into the UI.
import type { ErrorCode } from "../../server/lib/errors";

export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly retryable: boolean;

  constructor(code: ErrorCode, message: string, retryable: boolean) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.retryable = retryable;
  }
}

export function parseEnvelope<T = unknown>(body: unknown): T {
  if (typeof body !== "object" || body === null || !("ok" in body)) {
    throw new ApiError("INTERNAL", "Something went wrong. Try again.", true);
  }
  const envelope = body as { ok: boolean; data: T | null; error: { code: ErrorCode; message: string; retryable: boolean } | null };
  if (envelope.ok) return envelope.data as T;
  const error = envelope.error;
  throw new ApiError(error?.code ?? "INTERNAL", error?.message ?? "Something went wrong. Try again.", error?.retryable ?? true);
}
