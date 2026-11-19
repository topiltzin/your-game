# Research: Fix 3D Job Timeout

Each decision was checked against the code in `your-game` and `~/emi_crafting` on 2026-11-19. Nothing was left as NEEDS CLARIFICATION.

## R1. Which worker: reuse `emi_crafting`'s Python worker, or write a TypeScript one?

**Decision**: TypeScript worker in `worker/`, reusing `workflows/create-model-core.ts`, `workflows/deps.ts`, and `workflows/sf3d-client.ts`.

**Rationale**:
- The pipeline (`createModel`) already exists, is tested (`tests/api/workflow-create-model.test.ts`), and calls the same SF3D request as `emi_crafting`.
- `emi_crafting`'s worker is tied to its own schema: `_load_photo` reads `photos`, the RPCs are `claim_model_conversion` and `complete_model_conversion`, and it downloads from the `photos` bucket. Adapting it means editing another project's code and keeping two languages in sync.
- One language, one test suite, one place where the status rules live.

**Alternatives considered**:
- *Run `emi_crafting/worker` unchanged*: rejected, because it only works on `photos` and `model_conversions`.
- *Fork `emi_crafting/worker` and point it at `model_jobs`*: rejected for now. It would be the right move if the two apps shared one job table; the data-model decision in R4 keeps them separate.

## R2. How does a worker claim a job safely?

**Decision**: `claim_model_job(p_worker_id)` in Postgres: `UPDATE ... WHERE id = (SELECT ... ORDER BY requested_at FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING *`. Already written in `supabase/migrations/0001_create_model_jobs.sql`.

**Rationale**: `SKIP LOCKED` lets several workers poll at once without taking the same row, and the claim sets `processing` in the same statement. This is the pattern `emi_crafting` uses (`claim_model_conversion`).

**Alternatives considered**:
- *Select, then update in two steps*: rejected; two workers can pick the same row.
- *Supabase Realtime push instead of polling*: rejected for now. It saves a few seconds but adds a subscription to keep alive. The 5-second poll meets SC-004.

## R3. Where does the worker run?

**Decision**: A long-lived Node process on one VM or container, restarted by systemd or the container runtime.

**Rationale**: A conversion takes about 4 minutes and can take up to the 10-minute deadline. Vercel functions are capped by the project's `maxDuration` (60 s here), and the Hobby plan limit is below 10 minutes. Supabase Edge Functions have a shorter limit (`emi_crafting`'s DEPLOYMENT.md says so). `emi_crafting` already runs its worker on a VM.

**Alternatives considered**:
- *Vercel with a higher `maxDuration`*: rejected. It cannot cover the 10-minute deadline on the current plan.
- *Vercel cron polling the queue*: rejected. Each run would still be bounded by the function limit.
- *Supabase Edge Functions*: rejected. Too short for a 4-minute job.

## R4. Where does job state live?

**Decision**: The Supabase table `model_jobs` in project `lrhvutyuikgvwuzaduil`, separate from `emi_crafting`'s `model_conversions`. Same project, different table, so the two apps stay independent.

**Rationale**: The user asked to reuse the same Supabase project. A separate table means no shared schema changes and no coupling to `emi_crafting`'s `photos` table.

**Alternatives considered**:
- *Reuse `model_conversions`*: rejected. It requires `photos` rows and an owner in `auth.users`, and `your-game` has no Supabase auth.

## R5. Where are the input photo and the model stored?

**Decision**: Private Supabase Storage bucket `sketch-runner`. Inputs at `inputs/<uuid>.<ext>` (written by `api/uploads`), models at `models/<jobId>.glb` (written by the worker). Migration `0002` creates the bucket.

**Rationale**: The user asked for Supabase, and the blob interface (`putPrivate`, `getPrivate`, `deletePrivate`) already hides the backend.

**Alternatives considered**:
- *Keep Cloudflare R2*: rejected by the user's request for Supabase.

## R6. How is the deadline enforced?

**Decision**: The job deadline stays `requested_at + 10 minutes`. Before each SF3D call, the worker passes `deadlineAt - now` as the call's timeout (`createModel` already does this at `workflows/create-model-core.ts:33-41`). A job past its deadline is marked `timed_out`. The stale sweep (`fail_stale_model_jobs`) catches jobs whose worker died.

**Rationale**: Matches the spec's FR-008 and SC-003, and the existing `JOB_DEADLINE_MS` in `server/lib/job-service.ts:13`.

## R7. What happens when the handoff goes wrong?

**Decision**: The claim is the only `queued` to `processing` transition. `createModel` must accept a job that is already `processing`. The worker never re-queues a job.

**Rationale**: Today `markProcessing` (`workflows/deps.ts:15`) requires `queued`. Once the claim moves the job to `processing`, that check would fail and `createModel` would return `skipped` (`workflows/create-model-core.ts:35`), leaving the job stuck until the sweep. This is the one behavioural change the pipeline needs; see plan phase 1.

## R8. Failure handling

**Decision**: Keep the current rules. `ExternalServiceError` from SF3D becomes `failed` (with `SERVICE_UNAVAILABLE`) or `timed_out` (past the deadline). Any other unexpected error from the pipeline is caught by `runCreateModel` (`workflows/create-model.ts`) and marked `failed` with `SERVICE_UNAVAILABLE`, so the worker never crashes on one job.

**Rationale**: Matches the current behaviour and the spec's User Story 2. There is no automatic retry of SF3D inside a job; the player starts a new job.

## R9. Concurrency and capacity

**Decision**: One job at a time per worker process. Scale by starting more processes on the same host or another host; `SKIP LOCKED` keeps them from colliding.

**Rationale**: The SF3D Space is a shared third-party service with its own queue, so parallelism inside one process adds risk without much gain.

## R10. Browser behaviour

**Decision**: No change. The browser keeps polling `GET /api/jobs/:id` (the status, not the pipeline). `src/screens/processing-screen.ts` polls every 5 seconds, backing off to 10 seconds, as its header comment and `contracts/api.md` describe.

**Rationale**: FR-009. Status changes reach the player within 10 seconds (SC-004).
