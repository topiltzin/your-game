// Runs the create-model pipeline for one job. Started in the background by server/lib/services.ts
// (via waitUntil), so it never rejects: an unexpected error marks the job failed instead of
// escaping into the platform, because there is no retry layer around it.
import { createModel, type CreateModelDeps, type CreateModelJob, type CreateModelOutcome } from "./create-model-core.js";

export async function runCreateModel(job: CreateModelJob, deps: CreateModelDeps): Promise<CreateModelOutcome> {
  try {
    return await createModel(job, deps);
  } catch (error) {
    console.error("create-model: unexpected failure", { jobId: job.id, error });
    await markFailedSafely(job.id, deps);
    return "failed";
  }
}

async function markFailedSafely(jobId: string, deps: CreateModelDeps): Promise<void> {
  try {
    await deps.markTerminal(jobId, "failed", "SERVICE_UNAVAILABLE");
  } catch (error) {
    console.error("create-model: could not mark job failed", { jobId, error });
  }
}
