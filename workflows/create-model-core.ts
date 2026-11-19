// Create-model pipeline as plain async logic. The background runner (create-model.ts) calls this;
// tests run it directly with fakes. Every status write is conditional, so late
// results never overwrite a cancelled or timed-out job.

import { ExternalServiceError } from "./sf3d-client.js";

export interface CreateModelJob {
  readonly id: string;
  readonly inputKey: string;
  readonly textureResolution: 512 | 1024;
  readonly deadlineAt: Date;
}

export type CreateModelOutcome = "ready" | "failed" | "timed_out" | "discarded" | "skipped";
type TerminalStatus = "failed" | "timed_out";
export type FailureReason = "SERVICE_UNAVAILABLE" | "TIMED_OUT" | "RESULT_TOO_LARGE";
/** A model over 50 MB MUST be rejected. Same limit as emi_crafting and the photos_model_file_size_range constraint. */
export const MAX_MODEL_BYTES = 52_428_800;

export interface CreateModelDeps {
  now(): Date;
  /** Conditional queued → processing. False when the job was already cancelled or timed out. */
  markProcessing(jobId: string): Promise<boolean>;
  readInput(inputKey: string): Promise<Uint8Array>;
  prepareImage(bytes: Uint8Array, textureResolution: 512 | 1024): Promise<Uint8Array>;
  /** Calls the external service; `timeoutMs` is the time left before the job deadline. */
  generateModel(image: Uint8Array, textureResolution: 512 | 1024, timeoutMs: number): Promise<Uint8Array>;
  storeModel(jobId: string, bytes: Uint8Array): Promise<string>;
  /** Conditional processing → ready. False when the job was cancelled or timed out meanwhile. */
  markReady(jobId: string, modelKey: string): Promise<boolean>;
  /** Conditional move to a terminal failure status with a fixed reason. */
  markTerminal(jobId: string, status: TerminalStatus, reason: FailureReason): Promise<boolean>;
  discardModel(modelKey: string): Promise<void>;
  deleteInput(inputKey: string): Promise<void>;
}

export async function createModel(job: CreateModelJob, deps: CreateModelDeps): Promise<CreateModelOutcome> {
  if (!(await deps.markProcessing(job.id))) return "skipped";
  if (deps.now() >= job.deadlineAt) return finishTerminal(job.id, "timed_out", deps);

  let modelBytes: Uint8Array;
  try {
    const input = await deps.readInput(job.inputKey);
    const image = await deps.prepareImage(input, job.textureResolution);
    const timeoutMs = job.deadlineAt.getTime() - deps.now().getTime();
    modelBytes = await deps.generateModel(image, job.textureResolution, timeoutMs);
  } catch (error) {
    if (!(error instanceof ExternalServiceError)) throw error; // unknown failure: the runner in create-model.ts marks the job failed
    const timedOut = deps.now() >= job.deadlineAt;
    return timedOut ? finishTerminal(job.id, "timed_out", deps) : finishTerminal(job.id, "failed", deps);
  }

  if (modelBytes.byteLength > MAX_MODEL_BYTES) {
    const rejected = await deps.markTerminal(job.id, "failed", "RESULT_TOO_LARGE");
    return rejected ? "failed" : "skipped";
  }

  const modelKey = await deps.storeModel(job.id, modelBytes);
  if (!(await deps.markReady(job.id, modelKey))) {
    await deps.discardModel(modelKey);
    return "discarded";
  }
  await deps.deleteInput(job.inputKey);
  return "ready";
}

async function finishTerminal(jobId: string, status: TerminalStatus, deps: CreateModelDeps): Promise<CreateModelOutcome> {
  const reason = status === "timed_out" ? "TIMED_OUT" : "SERVICE_UNAVAILABLE";
  const applied = await deps.markTerminal(jobId, status, reason);
  return applied ? status : "skipped";
}
