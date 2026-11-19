# Quickstart: Verify the 3D Job Timeout Fix

Use this to prove the fix end to end once tasks are implemented. Implementation details live in `tasks.md`; the interfaces are in `contracts/worker-job-contract.md` and `data-model.md`.

## Prerequisites

1. Migrations `0001_create_model_jobs.sql` and `0002_create_sketch_bucket.sql` are applied to Supabase project `lrhvutyuikgvwuzaduil`.
2. `.env.local` (or the environment) has `SUPABASE_URL` and `SUPABASE_SECRET_KEY`. For the worker, also `SF3D_API_URL` if you are not using the default.
3. Dependencies installed: `npm install`.

## 1. Automated checks

```bash
npx tsc --noEmit        # types
npx vitest run          # unit tests, including the worker loop and claim tests
npm run build           # front end and API build
```

All three must pass before the manual checks.

## 2. Start the API and the worker locally

```bash
npm run dev             # Vite dev server; serves /api/* through the local middleware
npm run worker          # the new worker; polls model_jobs every POLL_SECONDS
```

The worker should log `worker <id> polling every 5s` and stay idle while the queue is empty.

## 3. Create a job and watch it finish

1. Upload a sketch: `POST /api/uploads` with a JPEG. Note the returned `inputKey`.
2. Start a job: `POST /api/jobs` with `{ "inputKey": "...", "textureResolution": 1024, "disclosureAccepted": true }`.
   - **Expected**: HTTP 201 in under 5 seconds, `status: "queued"`, and an `accessToken`.
   - **Failure to watch for**: any 504 or platform timeout here means the request still runs the pipeline.
3. In the worker log, expect `claimed job <id>`, then about 4 minutes later `job <id> ready`.
4. Poll `GET /api/jobs/<id>` with `Authorization: Bearer <accessToken>`. The status moves `queued` → `processing` → `ready`, and `modelKey` is set.
5. Open the model: `GET /api/models/<signed path>` returns the GLB bytes.

## 4. Failure and timeout checks

- **Bad SF3D URL**: set `SF3D_API_URL` to an unreachable address and start a job. The job ends as `failed` with `SERVICE_UNAVAILABLE`, and the worker keeps running.
- **Stale job**: insert a `queued` row with `requested_at` more than 10 minutes ago, or stop the worker mid-job and wait. Run `select public.fail_stale_model_jobs();` in the SQL editor. The row becomes `timed_out` with `TIMED_OUT`.
- **Cancel race**: cancel a job while it is `processing`, then let the worker finish. The status stays `cancelled`.

## 5. Concurrency check

Start two worker processes with different `WORKER_ID` values and two jobs. Each job is claimed by exactly one worker (`worker_id` differs between the two rows).

## Done when

- Step 1 passes.
- Step 3 completes a ~4-minute job with no timeout error in the API logs.
- Step 4 failure and timeout cases end in a final status with a reason.
- Step 5 shows no double claims.

## Run record (2026-11-19, local, no live services)

- **Step 1 (automated)**: PASS. `tsc --noEmit` clean; `vitest run` 28 files, 140 tests; `npm run build` succeeds; native-ESM import of the four API handlers succeeds.
- **Step 2 (worker starts)**: PARTIAL. With `SUPABASE_URL` and `SUPABASE_SECRET_KEY` unset, `npm run worker` exits 1 with `SUPABASE_URL is not set`. The live polling log was not checked: it needs the real project.
- **Steps 3 to 5 (create job, 4-minute conversion, failure and concurrency checks)**: NOT RUN. They need the live Supabase project (migrations 0001 and 0002 applied, secret key set) and the SF3D Space. Run them on the worker host before closing this feature.
- **Coverage**: 81.5% of lines across `worker/`, `workflows/`, `server/lib/db.ts`, `server/lib/job-service.ts`, `server/lib/blob.ts`. The uncovered part is the worker's `main()` and signal handling in `worker/index.ts`.
