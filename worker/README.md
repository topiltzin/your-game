# Worker

The worker generates 3D models for queued jobs. The API only records a job; this process claims it from the Supabase `model_jobs` table, calls the 3D service (a conversion takes about 4 minutes), stores the model in the private `sketch-runner` bucket, and writes the final status. See `specs/002-fix-3d-job-timeout/` for the design.

## Requirements

- Node.js 24 or later, on a host that stays up (a VM or a container). It must reach Supabase and the 3D service over HTTPS.
- Migrations `supabase/migrations/0001_create_model_jobs.sql` and `0002_create_sketch_bucket.sql` already applied to the project.
- `npm install` run in the repository.

## Environment

Names only. Put the values in the host's environment or a secrets store, never in the repository.

| Name | Required | Meaning |
|------|----------|---------|
| `SUPABASE_URL` | yes | Project URL (same project as the API). |
| `SUPABASE_SECRET_KEY` | yes | Service-role key. Server and worker only. |
| `SF3D_API_URL` | no | 3D service endpoint. Defaults to the public Space. |
| `WORKER_ID` | no | Label written to each claimed row. Defaults to the hostname. |
| `POLL_SECONDS` | no | Idle sleep between polls. Defaults to `5`. |

The worker exits at startup with a message naming any missing required variable.

## Run

```bash
npm run worker
```

Expected output on a healthy start:

```text
<timestamp> worker <id> polling every 5s
```

When a job is claimed: `claimed job <id>`, then `job <id> finished: ready` (or `failed` / `timed_out`).

Stop with `SIGINT` or `SIGTERM`. The worker finishes the current job, then exits.

## Keep it running

Run it under a process supervisor so it restarts after a crash or a host reboot.

**systemd** (example unit; put the variables in an `EnvironmentFile` readable only by the service user):

```ini
[Unit]
Description=sketch-runner 3D worker
After=network-online.target
Wants=network-online.target

[Service]
WorkingDirectory=/opt/your-game
EnvironmentFile=/etc/sketch-runner/worker.env
ExecStart=/usr/bin/npm run worker
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

**Docker:** run the same command with `--restart unless-stopped` and pass the variables with `--env-file`.

## Scaling

One process handles one job at a time. To process more jobs in parallel, start more processes (on the same host or another) with different `WORKER_ID` values. The claim uses `FOR UPDATE SKIP LOCKED`, so two workers never take the same job.

## Logs

Each line starts with a UTC timestamp and the worker ID. Look for:

- `marked N stale job(s) as timed out`: jobs past their 10-minute deadline were swept.
- `poll cycle failed: ...`: a database or network error. The worker keeps polling.
- `job <id> finished: failed`: the 3D service failed. The reason is stored on the job, not in the log.

No keys, tokens, or upstream response bodies are written to the logs.
