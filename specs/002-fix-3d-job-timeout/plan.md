# Implementation Plan: Fix 3D Job Timeout

**Branch**: `main` | **Date**: 2026-11-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-fix-3d-job-timeout/spec.md`

## Summary

Starting a 3D job currently runs the whole pipeline (about 4 minutes) inside the Vercel request that created it, but Vercel cuts that request off at 60 seconds. The fix moves generation out of the request: the start endpoint only inserts a `queued` row in the shared Supabase `model_jobs` table, and a long-running worker on a separate host claims queued jobs with a locked RPC, calls the same SF3D endpoint `emi_crafting` uses, stores the model in the private Supabase bucket, and writes the final status. The browser keeps polling the existing job endpoint. Research decisions are in [research.md](./research.md).

## Technical Context

**Language/Version**: TypeScript 6 on Node.js 24 (ESM), same as the app.

**Primary Dependencies**: `@supabase/supabase-js` 2.119.2 (already installed), `@vercel/functions` 3.11.3 (`waitUntil`, to be removed from the start path), existing `workflows/create-model-core.ts`, `workflows/deps.ts`, `workflows/sf3d-client.ts`. New dev dependency: `tsx`, to run the worker from TypeScript.

**Storage**: Supabase Postgres table `model_jobs` (migration `0001`), Supabase Storage bucket `sketch-runner` (migration `0002`), private.

**Testing**: Vitest (`npx vitest run`). Unit tests for the worker loop and the claim/sweep wrapper use fakes; no live Supabase or SF3D calls in CI.

**Target Platform**: Vercel (API routes, Fluid Compute, `maxDuration` 60 s) for the HTTP side; one long-lived Linux host (VM or container) for the worker.

**Project Type**: Web application (Vite front end, Vercel API functions) plus one background worker process.

**Performance Goals**: Start request returns in under 5 seconds. A ~4-minute conversion finishes with `ready`. Status changes reach the browser within 10 seconds (5-second poll). Every job reaches a final state within 10 minutes of request.

**Constraints**: API function duration limit 60 s (`vercel.json`). Job deadline 10 minutes (`JOB_DEADLINE_MS`). Supabase secret key only on server and worker, never in `VITE_*` or browser bundles. SF3D call sends `image` and `texture_resolution` as multipart, same as `emi_crafting`.

**Scale/Scope**: Low volume (5 jobs per hour per client IP). One worker process handles one job at a time; run more processes to process more jobs in parallel.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` is still the unfilled template, so it defines no ratified principles and no gates. The project rules in the user's global configuration apply instead, and the plan follows them:

- **Test-first**: each change starts with a failing test (RED), then the minimal implementation (GREEN), then refactor.
- **Coverage**: at least 80% on new code.
- **Immutability and explicit errors**: new code returns new values and handles every error path; nothing fails silently.
- **Secrets**: no keys in code or committed env files; only names are documented.
- **Single source of truth**: the worker reuses the existing create-model pipeline instead of copying it.

Result: PASS, with no violations to justify. Complexity Tracking below is empty.

## Project Structure

### Documentation (this feature)

```text
specs/002-fix-3d-job-timeout/
├── plan.md              # This file
├── research.md          # Phase 0 decisions
├── data-model.md        # Phase 1: model_jobs, states, storage paths
├── quickstart.md        # Phase 1: how to verify the fix end to end
├── contracts/
│   └── worker-job-contract.md   # Phase 1: DB RPCs, storage keys, worker env
├── checklists/requirements.md
└── tasks.md             # Created by /speckit-tasks, not by this plan
```

The public HTTP contract (`POST /api/jobs`, `GET /api/jobs/:id`) is unchanged and remains in `specs/001-sketch-runner-3d/contracts/api.md`.

### Source Code (repository root)

```text
api/jobs/index.ts            # POST: insert queued job only (no pipeline start)
api/jobs/[id].ts             # GET: unchanged
api/models/[...key].ts       # GET model: unchanged, reads from Supabase bucket via blob.ts

server/lib/services.ts       # Remove startWorkflow wiring and waitUntil
server/lib/job-service.ts    # Remove startWorkflow from JobServiceDeps; createJob inserts and returns
server/lib/db.ts             # Supabase repository (done); add claim and sweep wrappers
server/lib/blob.ts           # Supabase Storage (done)

workflows/create-model-core.ts   # Pipeline (unchanged except comments)
workflows/create-model.ts        # runCreateModel(job, deps): becomes the worker's per-job runner
workflows/deps.ts                # markProcessing no longer requeues: the claim sets processing
workflows/sf3d-client.ts         # Unchanged (same request as emi_crafting)

worker/index.ts              # NEW: poll loop: sweep stale -> claim -> runCreateModel -> repeat
worker/config.ts             # NEW: reads WORKER_ID, POLL_SECONDS, SUPABASE_*, SF3D_API_URL
worker/claim.ts              # NEW: claim_model_job and fail_stale_model_jobs RPC wrappers

supabase/migrations/0001_create_model_jobs.sql    # Table and RPCs (applied)
supabase/migrations/0002_create_sketch_bucket.sql # Bucket (applied)

tests/api/worker-loop.test.ts        # NEW: loop, claim, idle, stale sweep, error paths
tests/api/worker-claim.test.ts       # NEW: RPC wrapper mapping, empty result
tests/api/job-create-no-pipeline.test.ts  # NEW: POST does not start a pipeline
```

**Structure Decision**: Keep the single TypeScript package. The worker lives in its own `worker/` folder so it can be deployed separately, but it imports the same `workflows/` and `server/lib/` modules as the API, so the pipeline has one implementation.

## Implementation Phases

These phases feed `/speckit-tasks`. Each one starts with failing tests.

1. **Fix the status handoff.** `workflows/create-model-core.ts:35` requires `markProcessing` to succeed, and `workflows/deps.ts:15` only moves `queued` to `processing`. Once the claim RPC does that transition, the worker would find the job already `processing`, `markProcessing` would return false, and the job would be skipped. Change the worker path so a claimed job is passed to `runCreateModel` as already processing (the claim is the transition). Keep the queued-to-processing path for callers that still start from `queued`.
2. **Stop starting the pipeline from the request.** Remove `startWorkflow` from `JobServiceDeps` (`server/lib/job-service.ts:39,102`), its wiring in `server/lib/services.ts:29`, the `waitUntil` call, and the `workflows/create-model.ts` directive file. `createJob` inserts the row and returns it. Update the two `startWorkflow` fakes in `tests/api/job-service.test.ts`.
3. **Build the worker loop.** `worker/index.ts` runs: sweep stale jobs, claim one job, run it through `runCreateModel`, and sleep `POLL_SECONDS` when idle. Errors in one cycle are logged and the loop continues. A stop signal ends the loop after the current job.
4. **Wire the claim.** `worker/claim.ts` calls `claim_model_job` and `fail_stale_model_jobs` through the Supabase client, and maps an empty result to "no job".
5. **Deployment and run.** Add `"worker": "tsx worker/index.ts"` to `package.json`. Run it on the host with a process supervisor (systemd or Docker restart policy). Set the worker env vars listed in the contract.
6. **Verify.** Follow `quickstart.md`: a 4-minute conversion reaches `ready`, and the start request returns in under 5 seconds.

## Complexity Tracking

> No constitution violations. Nothing to justify.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |
