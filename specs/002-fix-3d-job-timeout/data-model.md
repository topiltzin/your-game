# Data Model: Fix 3D Job Timeout

Source of truth: `supabase/migrations/0001_create_model_jobs.sql` (table and RPCs) and `supabase/migrations/0002_create_sketch_bucket.sql` (bucket). This document describes them; it does not redefine them.

## Entity: Job (`public.model_jobs`)

One row per 3D conversion request.

| Field | Type | Set by | Notes |
|-------|------|--------|-------|
| `id` | uuid, primary key | API (`createJob`) | Generated server-side. |
| `access_token_hash` | text, required | API | SHA-256 of the one-time access token. The token itself is never stored. |
| `status` | text, required | API, worker | One of `queued`, `processing`, `ready`, `failed`, `timed_out`, `cancelled`. Default `queued`. |
| `input_key` | text, required | API (from upload) | Storage key `inputs/<uuid>.<ext>`. |
| `texture_resolution` | smallint, required | API | 512 or 1024. |
| `model_key` | text, nullable | worker | Storage key `models/<jobId>.glb`; set only with `ready`. |
| `failure_reason` | text, nullable | worker, sweep | Fixed codes, for example `SERVICE_UNAVAILABLE`, `TIMED_OUT`. |
| `requested_at` | timestamptz, required | API | Starts the 10-minute deadline. |
| `updated_at` | timestamptz, required | API, worker | Set on every write. |
| `started_at` | timestamptz, nullable | claim RPC | Set when a worker claims the job. |
| `worker_id` | text, nullable | claim RPC | Identifies the worker process. |
| `ip_hash` | text, required | API | Salted hash of the client IP; the raw IP is never stored. Used for the 5-per-hour limit. |

### Indexes

- `model_jobs_status_requested_idx (status, requested_at)`: the claim and the sweep.
- `model_jobs_ip_requested_idx (ip_hash, requested_at)`: the per-client limit.
- `model_jobs_input_active_idx (input_key) WHERE status IN ('queued', 'processing')`: rejects a second active job for the same input.

### Access

Row-level security is on with no policies. Only the service role (API and worker) reads or writes the table. The browser never touches it directly.

## State transitions

```text
            API insert                claim_model_job              worker finishes
  (none) ───────────────▶ queued ───────────────────────▶ processing ───────────────▶ ready
                           │                                  │  │
                           │ cancel (API)                     │  │ SF3D error / unexpected
                           ▼                                  │  ▼
                       cancelled ◀────────────────────────────┘ failed
                           ▲                                  │
          stale sweep      │                                  │ past requested_at + 10 min
          (queued or       └──────────── timed_out ◀──────────┘
           processing past 10 min)
```

Rules:

- `queued` to `processing` happens only in `claim_model_job`. Nothing else sets `processing`.
- Every worker write is conditional on the current status, so a late result cannot overwrite `cancelled` or `timed_out`:
  - `ready`: only from `processing`.
  - `failed` and `timed_out`: only from `queued` or `processing`.
- `ready` requires `model_key`. `failed` requires `failure_reason`.

## Storage objects (bucket `sketch-runner`, private)

| Path | Written by | Read by | Deleted when |
|------|-----------|---------|--------------|
| `inputs/<uuid>.<ext>` | API upload | worker, once per job | After the model is stored (`deleteInput`). |
| `models/<jobId>.glb` | worker, on success | model endpoint (`GET /api/models/...`) | When the job is discarded (`discardModel`). |

## Validation rules from the spec

- Input key must match `inputs/<uuid>.(jpg|png|webp)` (already enforced in `api/jobs/index.ts`).
- Texture resolution must be 512 or 1024.
- A model larger than 50 MB MUST be rejected (`failed` with a fixed reason). The check does not exist in `your-game` yet; it is a task for the worker phase, matching `emi_crafting`'s limit.
- One active job per input (`findActiveByInput`).
