// Worker process: claims queued 3D jobs and runs each through the create-model pipeline, outside
// the browser request. Start with `npm run worker` (see worker/README.md).
import { pathToFileURL } from "node:url";
import { createSupabase } from "../server/lib/db.js";
import type { CreateModelJob, CreateModelOutcome } from "../workflows/create-model-core.js";
import { runCreateModel } from "../workflows/create-model.js";
import { createProductionDeps } from "../workflows/deps.js";
import { claimNextJob, sweepStaleJobs } from "./claim.js";
import { loadWorkerConfig } from "./config.js";

export interface WorkerDeps {
  readonly workerId: string;
  readonly pollMs: number;
  claim(): Promise<CreateModelJob | null>;
  run(job: CreateModelJob): Promise<CreateModelOutcome>;
  sweep(): Promise<number>;
  sleep(ms: number): Promise<void>;
  log(message: string): void;
}

export interface StopSignal {
  stopped: boolean;
}

/** One poll: claim a job and run it. Returns false when the queue was empty. */
export async function runWorkerCycle(deps: WorkerDeps): Promise<boolean> {
  const timedOut = await deps.sweep();
  if (timedOut > 0) deps.log(`marked ${timedOut} stale job(s) as timed out`);
  const job = await deps.claim();
  if (!job) return false;
  deps.log(`claimed job ${job.id}`);
  const outcome = await deps.run(job);
  deps.log(`job ${job.id} finished: ${outcome}`);
  return true;
}

/**
 * Polls until the stop signal is set. Sleeps only when the queue was empty. A failing cycle is
 * logged and the loop goes on, so one bad poll never stops the worker.
 */
export async function runWorkerLoop(deps: WorkerDeps, stop: StopSignal): Promise<void> {
  while (!stop.stopped) {
    try {
      const ran = await runWorkerCycle(deps);
      if (ran) continue;
    } catch (error) {
      deps.log(`poll cycle failed: ${describe(error)}`);
    }
    await deps.sleep(deps.pollMs);
  }
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Connects the loop to Supabase, the pipeline, and the console. Used only by the entry point. */
export function createWorkerDeps(workerId: string, pollMs: number, sf3dUrl: string): WorkerDeps {
  const db = createSupabase();
  const pipeline = createProductionDeps(sf3dUrl);
  const log = (message: string) => console.log(`${new Date().toISOString()} worker ${workerId} ${message}`);
  return {
    workerId,
    pollMs,
    claim: () => claimNextJob(db, workerId),
    run: (job) => runCreateModel(job, pipeline),
    sweep: () => sweepStaleJobs(db),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    log,
  };
}

export async function main(): Promise<void> {
  const config = loadWorkerConfig();
  const deps = createWorkerDeps(config.workerId, config.pollMs, config.sf3dUrl);
  const stop: StopSignal = { stopped: false };
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, () => {
      deps.log(`${signal} received: stopping after the current job`);
      stop.stopped = true;
    });
  }
  deps.log(`polling every ${config.pollMs / 1000}s`);
  await runWorkerLoop(deps, stop);
  deps.log("stopped");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(`worker failed to start: ${describe(error)}`);
    process.exitCode = 1;
  });
}
