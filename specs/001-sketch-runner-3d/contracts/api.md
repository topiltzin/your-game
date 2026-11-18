# API Contract: Character Jobs

**Feature**: [spec.md](../spec.md) | **Data model**: [data-model.md](../data-model.md)

Base path: `/api`. All bodies are JSON unless noted. Times are ISO 8601 UTC.

## Conventions

**Success envelope**:

```json
{ "ok": true, "data": { }, "error": null }
```

**Error envelope** (nullable `data`, `error` set):

```json
{ "ok": false, "data": null, "error": { "code": "IMAGE_TYPE_UNSUPPORTED", "message": "Use JPEG, PNG, WebP, or HEIC.", "retryable": false } }
```

**Auth**: No accounts. Job routes require header `Authorization: Bearer <jobToken>` returned at creation. Tokens are random 256-bit values; only their SHA-256 is stored.

**Rate limit**: `POST /api/jobs` allows 5 creations per IP per hour; exceeding returns `429` with `RATE_LIMITED`.

## Error codes

| Code | HTTP | Player message (fixed) | Retryable |
|---|---|---|---|
| `IMAGE_TYPE_UNSUPPORTED` | 415 | "Use JPEG, PNG, WebP, or HEIC." | no |
| `IMAGE_TOO_LARGE` | 413 | "Keep images under 10 MB." | no |
| `IMAGE_INVALID` | 422 | "That file doesn't look like an image." | no |
| `CHARACTER_UNREADABLE` | 422 | "We couldn't find a character. Try drawing it bigger." | no |
| `DISCLOSURE_REQUIRED` | 400 | "Confirm that your image can be sent to the 3D service." | no |
| `RATE_LIMITED` | 429 | "Lots of models in a row. Try again in a little while." | yes |
| `JOB_NOT_FOUND` | 404 | "This model isn't available anymore." | no |
| `JOB_ALREADY_ACTIVE` | 409 | "This character is already being made into 3D." | no |
| `SERVICE_UNAVAILABLE` | 503 | "The 3D maker is busy right now. You can still play in 2D." | yes |
| `INTERNAL` | 500 | "Something went wrong. Try again." | yes |

## POST /api/uploads

Requests a private upload target for the prepared image. The client uploads the image directly to Blob, avoiding function body limits.

**Request**:

```json
{ "contentType": "image/png", "byteSize": 834122 }
```

**Response 200**:

```json
{ "ok": true, "data": { "uploadUrl": "https://...", "inputKey": "inputs/pending-7f3a.png", "expiresAt": "2026-11-18T12:10:00Z" }, "error": null }
```

**Rules**: `contentType` in {`image/jpeg`, `image/png`, `image/webp`}; HEIC is converted to JPEG in the browser before this call. `byteSize` ≤ 10 MB. Server rejects mismatched magic bytes after upload (`IMAGE_INVALID`).

## POST /api/jobs

Creates a 3D job for an uploaded image.

**Request**:

```json
{ "inputKey": "inputs/pending-7f3a.png", "textureResolution": 1024, "disclosureAccepted": true }
```

**Rules**: `disclosureAccepted` must be `true` (FR-007); otherwise `400 DISCLOSURE_REQUIRED`. `textureResolution` one of {512, 1024}.

**Response 201**:

```json
{
  "ok": true,
  "data": {
    "job": { "id": "6f1c2d9e-...", "status": "queued", "requestedAt": "2026-11-18T12:00:00Z", "deadlineAt": "2026-11-18T12:10:00Z" },
    "accessToken": "b64url-256-bit-token"
  },
  "error": null
}
```

Errors: `IMAGE_*`, `DISCLOSURE_REQUIRED`, `RATE_LIMITED`, `JOB_ALREADY_ACTIVE`.

## GET /api/jobs/{id}

Poll status. Client polls every 5 s with backoff to 10 s while `queued` or `processing`.

**Headers**: `Authorization: Bearer <jobToken>`

**Response 200**:

```json
{
  "ok": true,
  "data": {
    "id": "6f1c2d9e-...",
    "status": "processing",
    "requestedAt": "2026-11-18T12:00:00Z",
    "deadlineAt": "2026-11-18T12:10:00Z",
    "modelUrl": null,
    "failure": null
  },
  "error": null
}
```

- When `status` is `ready`, `modelUrl` is a short-lived (15 min) signed URL to the model file; the client re-requests this endpoint to refresh it.
- When `status` is `failed` or `timed_out`, `failure` is `{ "code": "SERVICE_UNAVAILABLE", "message": "...", "retryable": true }`.
- Errors: `JOB_NOT_FOUND` (also returned for wrong token, to avoid leaking existence).

## DELETE /api/jobs/{id}

Cancel a `queued` or `processing` job. Idempotent.

**Headers**: `Authorization: Bearer <jobToken>`

**Response 200**: `{ "ok": true, "data": { "id": "...", "status": "cancelled" }, "error": null }`

Terminal jobs return their current status unchanged.

## Timeout behavior

A job whose `deadlineAt` has passed is moved to `timed_out` by the workflow; if the workflow is gone, the next `GET` observes the deadline and performs the same conditional update (lazy timeout). Player sees "This one took too long. Want to try again?" (FR-005).

## Workflow contract (internal, not HTTP)

`workflows/create-model.ts` input: `{ jobId, inputKey, textureResolution }`.

1. Conditional update `queued → processing`.
2. Fetch input from private Blob; orientation-normalize and downscale to the requested resolution.
3. Call the configured external image-to-3D endpoint (env `SF3D_API_URL`, default from emi_crafting). Single synchronous call, bounded by the remaining time before `deadlineAt`.
4. Store response bytes at `models/{jobId}.glb`.
5. Conditional update `processing → ready` with `model_key`. If the job is already `cancelled` or `timed_out`, discard the stored model.
6. On service error: conditional update to `failed` with a fixed reason. Never store raw upstream error text.
7. Delete `inputs/{jobId}.*` on `ready`.
