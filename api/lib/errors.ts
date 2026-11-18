// Error codes, HTTP statuses, and fixed player-facing messages (contracts/api.md "Error codes").
// Internal details never reach the player: messages come only from this table.

export type ErrorCode =
  | "IMAGE_TYPE_UNSUPPORTED"
  | "IMAGE_TOO_LARGE"
  | "IMAGE_INVALID"
  | "CHARACTER_UNREADABLE"
  | "DISCLOSURE_REQUIRED"
  | "VALIDATION"
  | "RATE_LIMITED"
  | "JOB_NOT_FOUND"
  | "JOB_ALREADY_ACTIVE"
  | "SERVICE_UNAVAILABLE"
  | "TIMED_OUT"
  | "INTERNAL";

export interface ErrorSpec {
  readonly status: number;
  readonly message: string;
  readonly retryable: boolean;
}

export const ERROR_TABLE: Record<ErrorCode, ErrorSpec> = {
  IMAGE_TYPE_UNSUPPORTED: { status: 415, message: "Use JPEG, PNG, WebP, or HEIC.", retryable: false },
  IMAGE_TOO_LARGE: { status: 413, message: "Keep images under 10 MB.", retryable: false },
  IMAGE_INVALID: { status: 422, message: "That file doesn't look like an image.", retryable: false },
  CHARACTER_UNREADABLE: { status: 422, message: "We couldn't find a character. Try drawing it bigger.", retryable: false },
  DISCLOSURE_REQUIRED: { status: 400, message: "Confirm that your image can be sent to the 3D service.", retryable: false },
  VALIDATION: { status: 400, message: "Check the request and try again.", retryable: false },
  RATE_LIMITED: { status: 429, message: "Lots of models in a row. Try again in a little while.", retryable: true },
  JOB_NOT_FOUND: { status: 404, message: "This model isn't available anymore.", retryable: false },
  JOB_ALREADY_ACTIVE: { status: 409, message: "This character is already being made into 3D.", retryable: false },
  SERVICE_UNAVAILABLE: { status: 503, message: "The 3D maker is busy right now. You can still play in 2D.", retryable: true },
  TIMED_OUT: { status: 200, message: "This one took too long. Want to try again?", retryable: true },
  INTERNAL: { status: 500, message: "Something went wrong. Try again.", retryable: true },
};

export function errorBody(code: ErrorCode): { ok: false; data: null; error: { code: ErrorCode; message: string; retryable: boolean } } {
  const spec = ERROR_TABLE[code];
  return { ok: false, data: null, error: { code, message: spec.message, retryable: spec.retryable } };
}
