// Worker settings from the environment. Names and defaults are listed in
// specs/002-fix-3d-job-timeout/contracts/worker-job-contract.md (section 5). No values are logged.
import { hostname } from "node:os";

export const DEFAULT_SF3D_URL = "https://ahmad-sarmad-ali-3d-model-ai.hf.space/generate-3d/";
const DEFAULT_POLL_SECONDS = 5;

export interface WorkerConfig {
  readonly supabaseUrl: string;
  readonly secretKey: string;
  readonly sf3dUrl: string;
  readonly workerId: string;
  readonly pollMs: number;
}

export function loadWorkerConfig(env: NodeJS.ProcessEnv = process.env): WorkerConfig {
  return {
    supabaseUrl: required(env, "SUPABASE_URL"),
    secretKey: required(env, "SUPABASE_SECRET_KEY"),
    sf3dUrl: env["SF3D_API_URL"] || DEFAULT_SF3D_URL,
    workerId: env["WORKER_ID"] || hostname(),
    pollMs: parsePollSeconds(env["POLL_SECONDS"]) * 1000,
  };
}

function required(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

function parsePollSeconds(raw: string | undefined): number {
  if (!raw) return DEFAULT_POLL_SECONDS;
  const seconds = Number(raw);
  if (!Number.isFinite(seconds) || seconds <= 0) throw new Error("POLL_SECONDS must be a positive number");
  return seconds;
}
