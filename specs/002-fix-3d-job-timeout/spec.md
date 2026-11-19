# Feature Specification: Fix 3D Job Timeout

**Feature Branch**: `main` (no branch created; this repo commits to main)

**Created**: 2026-11-19

**Status**: Draft

**Input**: User description: "fix the issue on the Supabase integration as same as emoilia-cratfting project.. stil failing Vercel Runtime Timeout Error: Task timed out after 60 seconds the 3d rendering took aprox 4min but on emilia-crafting works properly! do it"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Turn a sketch into a 3D model that finishes (Priority: P1)

A player uploads a drawing, starts a 3D conversion, and waits while it is generated. The conversion typically takes about 4 minutes. Today the request that starts the job is cut off after 60 seconds, so the job never completes. The player should see the model once it is ready, however long generation takes within the job deadline.

**Why this priority**: Without this, the core feature (sketch to 3D model) does not work in production. Everything else depends on it.

**Independent Test**: Start one conversion with a sketch that takes about 4 minutes to generate. The job reaches `ready`, and the player can view the model. No platform timeout error appears in the logs.

**Acceptance Scenarios**:

1. **Given** a valid uploaded sketch, **When** the player starts a conversion, **Then** the start request returns immediately with the job, and the job is not cut off by a 60-second limit.
2. **Given** a conversion that takes about 4 minutes, **When** generation finishes, **Then** the job becomes `ready` and the model is viewable.
3. **Given** a job the player started, **When** the player checks its status, **Then** they see `queued`, then `processing`, then `ready` or `failed`.

---

### User Story 2 - Failed or stuck conversions end clearly (Priority: P2)

If the 3D service is unavailable, or a job runs past its deadline, the player gets a clear final state instead of waiting forever.

**Why this priority**: Without a terminal state, players wait indefinitely and retry blindly.

**Independent Test**: Make the 3D service fail, or let a job exceed its 10-minute deadline. The job reaches `failed` or `timed_out` with a reason, and the player can start a new attempt.

**Acceptance Scenarios**:

1. **Given** the 3D service is unreachable, **When** a conversion runs, **Then** the job becomes `failed` with a fixed reason.
2. **Given** a job still `queued` or `processing` after 10 minutes, **When** the status is checked or the stale sweep runs, **Then** the job becomes `timed_out`.

---

### Edge Cases

- What happens when the worker is down? Queued jobs wait; once the worker returns, they are claimed. Jobs older than 10 minutes become `timed_out`.
- What happens when two workers poll at once? Each job is claimed by exactly one worker.
- What happens when a player starts a second conversion for the same sketch while one is active? The existing "already active" rule rejects it.
- What happens when a result arrives after the job was cancelled or timed out? The result is discarded and the status does not change.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The start-conversion request MUST return within the platform's request limit, without waiting for generation to finish.
- **FR-002**: Generation MUST run outside the web request, in a long-running worker, with a deadline of 10 minutes per job.
- **FR-003**: The worker MUST claim queued jobs so that each job is processed by one worker only.
- **FR-004**: The 3D service call MUST send the uploaded image and the texture resolution, and receive the model file, using the same request as `emi_crafting`.
- **FR-005**: Job state MUST live in the shared Supabase project, in the `model_jobs` table.
- **FR-006**: Uploaded sketches and generated models MUST be stored in a private Supabase Storage bucket, `sketch-runner`.
- **FR-007**: Status writes MUST be conditional, so a late result never overwrites a cancelled or timed-out job.
- **FR-008**: Jobs older than 10 minutes that are still `queued` or `processing` MUST become `timed_out`.
- **FR-009**: The player's status view MUST continue to poll the job endpoint; the browser flow does not change.
- **FR-010**: The Supabase secret key MUST exist only on the server and the worker, never in browser code.

### Key Entities *(include if feature involves data)*

- **Job**: One conversion request. Attributes: id, status, input location, texture resolution, model location, failure reason, requested time, worker that claimed it, start time. Owned by the requester through a hashed access token.
- **Sketch input**: The uploaded image, stored privately; referenced by the job.
- **Model file**: The generated 3D file, stored privately; referenced by the job.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A conversion that takes about 4 minutes completes with the status `ready` in 100% of test runs.
- **SC-002**: No start request fails with a platform timeout error.
- **SC-003**: Every job reaches a final state (`ready`, `failed`, or `timed_out`) within 10 minutes of being requested.
- **SC-004**: Players see status changes within 10 seconds of them happening.

## Assumptions

- The worker runs on a long-lived host (a VM or container), as in `emi_crafting`'s deployment guide, with network access to Supabase and the 3D service.
- The shared Supabase project and its migrations (`0001` table, `0002` bucket) are applied before the change goes live.
- Players keep the existing flow: upload, start, poll for status, view the model.
- The 10-minute deadline and the 5-job-per-hour limit stay as they are today.
- The `emi_crafting` worker is reused in code or config; its behaviour is the reference.
