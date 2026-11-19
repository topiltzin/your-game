// Durable create-model workflow (Vercel Workflow SDK). The workflow function only orchestrates;
// the pipeline runs inside a step, which has full Node.js access and is retried on transient failure.
import { createModel, type CreateModelJob } from "./create-model-core.js";
import { createProductionDeps } from "./deps.js";

export async function createModelWorkflow(job: CreateModelJob) {
  "use workflow";
  return runCreateModel(job);
}

async function runCreateModel(job: CreateModelJob) {
  "use step";
  return createModel(job, createProductionDeps());
}
