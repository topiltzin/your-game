# Contract: Worker ↔ Supabase job queue

This is the interface between the API and the worker. The public HTTP contract is unchanged: see `specs/001-sketch-runner-3d/contracts/api.md`.

## 1. Database RPCs (service role only)

Defined in `supabase/migrations/0001_create_model_jobs.sql`. Both are `SECURITY DEFINER`, and `EXECUTE` is granted only to `service_role`.

### `claim_model_job(p_worker_id text) → model_jobs | null`

- Atomically takes the oldest `queued` job (`ORDER BY requested_at`, `FOR UPDATE SKIP LOCKED`).
- Sets `status = 'processing'`, `started_at = now()`, `worker_id = p_worker_id`, `updated_at = now()`.
- Returns the claimed row, or no row when the queue is empty.
- The worker maps "no row" (or a row of nulls, as PostgREST can return) to "no job" and sleeps.

### `fail_stale_model_jobs() → integer`

- Marks every `queued` or `processing` job older than 10 minutes (`requested_at < now() - interval '10 minutes'`) as `timed_out` with `failure_reason = 'TIMED_OUT'`.
- Returns the number of rows changed. The worker logs a non-zero count.

## 2. Conditional status writes (table, service role)

The worker updates `model_jobs` directly with `UPDATE ... WHERE id = $1 AND status IN (...)`, the same as the current repository (`server/lib/db.ts`, `update()`):

| Call | From statuses | To status | Extra fields |
|------|---------------|-----------|--------------|
| mark ready | `processing` | `ready` | `model_key` |
| mark failed | `queued`, `processing` | `failed` | `failure_reason` (`SERVICE_UNAVAILABLE`) |
| mark timed out | `queued`, `processing` | `timed_out` | `failure_reason` (`TIMED_OUT`) |

A write that matches no row returns `false`. The worker treats that as "already cancelled or timed out": discard the model and move on. It is not an error.

## 3. Storage (bucket `sketch-runner`, private)

- Read the input: `inputs/<uuid>.<ext>`.
- Write the model: `models/<jobId>.glb`, content type `model/gltf-binary`, no overwrite.
- Delete on discard or after success (input only).

## 4. 3D service call

Same request as `emi_crafting` and as `workflows/sf3d-client.ts`:

```text
POST {SF3D_API_URL}            (default https://ahmad-sarmad-ali-3d-model-ai.hf.space/generate-3d/)
Accept: */*
multipart/form-data:
  image                 = <input bytes>, type image/jpeg
  texture_resolution    = 512 | 1024
response body           = GLB bytes
timeout                 = time left before the job deadline (requested_at + 10 min)
```

Any failure from this call marks the job `failed` (or `timed_out` when past the deadline). The job is not retried automatically; the player starts a new job.

## 5. Worker environment

| Name | Required | Purpose |
|------|----------|---------|
| `SUPABASE_URL` | yes | Project URL (same project as the API). |
| `SUPABASE_SECRET_KEY` | yes | Service-role key. Server and worker only. Never in `VITE_*`. |
| `SF3D_API_URL` | no | Defaults to the public Space URL above. |
| `WORKER_ID` | no | Label written to `worker_id`. Defaults to the hostname. |
| `POLL_SECONDS` | no | Idle sleep between claims. Default `5`. |

## 6. Invariants

- A job is claimed by exactly one worker.
- Only `claim_model_job` moves a job from `queued` to `processing`.
- No write from the worker can change a `cancelled` or `timed_out` job.
- No key, token, or upstream response body is written to logs or to `failure_reason`.
