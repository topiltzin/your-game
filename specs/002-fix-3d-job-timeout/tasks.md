# Tasks: Fix 3D Job Timeout

**Input**: Design documents from `/specs/002-fix-3d-job-timeout/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/worker-job-contract.md, quickstart.md

**Tests**: Included. The spec does not ask for them, but the project rules require test-first work (RED, then GREEN, then refactor) with at least 80% coverage on new code. Each test task is written and seen to fail before its implementation task.

**Organization**: Tasks are grouped by user story: US1 (3D jobs finish without the request timing out) and US2 (failed or stuck jobs end in a clear final state).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2)
- Exact file paths are in every description

## Path Conventions

Single TypeScript package at the repository root: `api/`, `server/`, `workflows/`, `worker/` (new), `tests/api/`, `supabase/migrations/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Tooling the worker needs to run from TypeScript.

- [X] T001 Install `tsx` as a dev dependency with `npm install -D tsx` (updates `package.json` and `package-lock.json`)
- [X] T002 Add the script `"worker": "tsx worker/index.ts"` to `package.json`
- [X] T003 [P] Document the worker variable names `WORKER_ID`, `POLL_SECONDS`, and `SF3D_API_URL` (names only, no values) in `.env.example`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The claim path and the status handoff. Both user stories depend on them.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T004 Write failing tests in `tests/api/worker-claim.test.ts`: `claimNextJob` maps a returned row to a job, returns `null` for an empty result and for a row of nulls, and `sweepStaleJobs` returns the count from `fail_stale_model_jobs`
- [X] T005 Implement `worker/claim.ts` with `claimNextJob(sb, workerId)` (calls `claim_model_job`) and `sweepStaleJobs(sb)` (calls `fail_stale_model_jobs`), both through the service-role Supabase client from `server/lib/db.ts`. Constraint from `data-model.md`: status values are limited to `queued`, `processing`, `ready`, `failed`, `timed_out`, `cancelled`.
- [X] T006 [P] Write a failing test in `tests/api/workflow-create-model.test.ts`: `createModel` accepts a job whose status is already `processing` (the claim already moved it), using a `markProcessing` fake that succeeds from `queued` or `processing`
- [X] T007 Change `markProcessing` in `workflows/deps.ts` (line 15) to `repo.update(jobId, ["queued", "processing"], { status: "processing" })` so a claimed job is accepted. Research R7 explains why the current `["queued"]` would skip every claimed job.

**Checkpoint**: The claim wrapper works and a claimed job is accepted by the pipeline.

---

## Phase 3: User Story 1 - 3D jobs finish without the request timing out (Priority: P1) 🎯 MVP

**Goal**: Starting a job returns at once, and a worker generates the model outside the request (about 4 minutes).

**Independent Test**: `POST /api/jobs` returns `queued` in under 5 seconds (quickstart step 3). A running worker takes the job and moves it to `ready` (quickstart steps 3 and 4).

### Tests for User Story 1 ⚠️

> Write these tests FIRST and confirm they FAIL before the implementation tasks below.

- [X] T008 [P] [US1] Write a failing test in `tests/api/job-create-no-pipeline.test.ts`: `createJob` inserts a `queued` row and returns it, and never calls a pipeline start
- [X] T009 [P] [US1] Write a failing test in `tests/api/worker-loop.test.ts`: one worker cycle claims a queued job and runs it through `runCreateModel`, and returns `false` when the claim is empty (idle)
- [X] T010 [P] [US1] Write a failing test in `tests/api/worker-loop.test.ts`: the loop logs and continues when one cycle throws, and stops after the stop signal is set

### Implementation for User Story 1

- [X] T011 [US1] Remove `startWorkflow` from `JobServiceDeps` (`server/lib/job-service.ts` line 39) and its call in `createJob` (line 102). `createJob` keeps the insert and returns the queued job.
- [X] T012 [US1] Update the two `startWorkflow` fakes in `tests/api/job-service.test.ts` (lines 41 and 148) to match the new dependency list
- [X] T013 [US1] In `server/lib/services.ts`, remove the imports on lines 3 to 5 (`waitUntil`, `runCreateModel`, `createProductionDeps`) and the `startWorkflow` block on lines 29 to 40
- [X] T014 [US1] Create `worker/config.ts`: read `SUPABASE_URL` and `SUPABASE_SECRET_KEY` (required), `SF3D_API_URL` (optional, defaults to the public Space URL), `WORKER_ID` (defaults to the hostname), `POLL_SECONDS` (defaults to `5`). Throw a clear error naming any missing required variable.
- [X] T015 [US1] Create `worker/index.ts` with `runWorkerCycle(deps)`: claim one job with `claimNextJob`, run it with `runCreateModel(job, createProductionDeps())`, and return `true` if a job ran and `false` if the queue was empty
- [X] T016 [US1] Add `runWorkerLoop(deps, stop)` to `worker/index.ts`: loop until `stop` is set, sleep `POLL_SECONDS` when idle, continue immediately when a job ran, and log and continue on errors
- [X] T017 [US1] Add the entry point to `worker/index.ts`: load config, start the loop, and on `SIGINT` or `SIGTERM` set the stop flag so the process exits after the current job

**Checkpoint**: Quickstart steps 1 to 3 pass. A starting job returns quickly, and the worker turns it into a ready model.

---

## Phase 4: User Story 2 - Failed or stuck jobs end in a clear final state (Priority: P2)

**Goal**: A job always reaches `ready`, `failed`, or `timed_out` with a reason, even when the 3D service fails, a model is too large, or the worker dies.

**Independent Test**: Quickstart step 4 passes: a bad `SF3D_API_URL` leaves the job `failed` with `SERVICE_UNAVAILABLE`, and a stale row becomes `timed_out` with `TIMED_OUT`.

### Tests for User Story 2 ⚠️

- [X] T018 [P] [US2] Write a failing test in `tests/api/worker-sweep.test.ts`: every worker cycle calls `sweepStaleJobs` before claiming, and logs the count when it is above zero
- [X] T019 [P] [US2] Write a failing test in `tests/api/workflow-create-model.test.ts`: a model over 52,428,800 bytes ends as `failed` with reason `RESULT_TOO_LARGE`, and `storeModel` is not called. Quoted constraint from `data-model.md`: "A model larger than 50 MB MUST be rejected (`failed` with a fixed reason)."
- [X] T020 [P] [US2] Check `tests/api/workflow-create-model.test.ts` and `tests/api/sf3d-client.test.ts`. If no test covers "timeout past the deadline ends as `timed_out`" and "an upstream error body is never copied into the job", add one that fails first.

### Implementation for User Story 2

- [X] T021 [US2] Call `sweepStaleJobs` at the start of each cycle in `worker/index.ts` and log the count when it is above zero
- [X] T022 [US2] Add the size check to `workflows/create-model-core.ts`, before `storeModel`: `MAX_MODEL_BYTES = 52_428_800`. Mark the job `failed` with `RESULT_TOO_LARGE`.
- [X] T023 [US2] Widen the failure-reason union on line 29 of `workflows/create-model-core.ts` (`markTerminal`) and the matching `markTerminal` in `workflows/deps.ts` (line 32) to include `RESULT_TOO_LARGE`
- [X] T024 [P] [US2] Confirm `workflows/sf3d-client.ts` builds errors only from fixed strings (no upstream body), and add a test in `tests/api/sf3d-client.test.ts` if one is missing

**Checkpoint**: Quickstart step 4 passes. Every job ends in a final state with a reason.

---

## Phase N: Polish & Cross-Cutting Concerns

**Purpose**: Remove what the move away from Vercel Workflow and Neon left behind, and verify the result.

- [X] T025 [P] Remove `@vercel/functions` from `package.json` with `npm uninstall @vercel/functions` once `grep -rn "@vercel/functions" server api workflows worker` returns nothing
- [X] T026 [P] Remove the Neon migration runner `db/migrate.ts`, `db/migrations/0001_create_model_jobs.sql`, the `db:migrate` script in `package.json`, and `@neondatabase/serverless` from `package.json`, after confirming nothing else imports them
- [X] T027 [P] Write `worker/README.md`: host setup, the systemd unit or Docker restart policy, the environment variable names from `contracts/worker-job-contract.md` (names only), and how to read the logs
- [ ] T028 Run quickstart steps 1 to 5 in `specs/002-fix-3d-job-timeout/quickstart.md` and record the results at the bottom of that file
- [X] T029 Check coverage for the new code with `npx vitest run --coverage` (configured in `vitest.config.ts`). The `worker/` and `workflows/` files must be at or above 80%.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies
- **Foundational (Phase 2)**: depends on Setup, and blocks both user stories
- **User Story 1 (Phase 3)**: depends on Foundational. This is the MVP.
- **User Story 2 (Phase 4)**: depends on Foundational. It also edits `worker/index.ts`, so run it after T016 and T017.
- **Polish (Phase N)**: depends on both stories being complete

### Within Each Story

- Tests come first and must fail before their implementation tasks
- `worker/config.ts` (T014) before `worker/index.ts` (T015 to T017)
- T021 (sweep call) after T016 (loop) and T018 (its test)

### Parallel Opportunities

- Setup: T003 runs alongside T001 and T002
- Foundational: T006 runs alongside T004 and T005
- US1 tests T008, T009, and T010 touch different files, so they can be written in parallel
- US2 tests T018, T019, and T020 can be written in parallel
- T024 and T027 are independent of each other

---

## Parallel Example: User Story 1

```bash
# Write the three US1 tests together (different files):
Task: "T008 job-create-no-pipeline test in tests/api/job-create-no-pipeline.test.ts"
Task: "T009 worker cycle test in tests/api/worker-loop.test.ts"
Task: "T010 worker loop error and stop test in tests/api/worker-loop.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 (Setup) and Phase 2 (Foundational)
2. Complete Phase 3 (User Story 1)
3. **Stop and validate**: quickstart steps 1 to 3. A 4-minute job must reach `ready`, and the start request must return in under 5 seconds.

### Incremental Delivery

1. Setup + Foundational: claim path and handoff work
2. US1: jobs finish outside the request (MVP)
3. US2: every job ends in a final state with a reason
4. Polish: remove leftovers, document the worker, verify coverage

---

## Notes

- Manual steps outside the repo (not checklist tasks): add `SUPABASE_URL` and `SUPABASE_SECRET_KEY` to the Vercel project environment, and remove `DATABASE_URL` and the `R2_*` variables once the new flow is verified in production.
- Migrations `0001_create_model_jobs.sql` and `0002_create_sketch_bucket.sql` must already be applied in Supabase before T015 runs against a real project.
- Commit after each task or logical group. Do not commit `.env.local*`.
