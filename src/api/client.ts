// Browser calls to the job API (contracts/api.md). Every response goes through parseEnvelope.
import { parseEnvelope } from "./envelope";

export interface PublicJob {
  readonly id: string;
  readonly status: string;
  readonly requestedAt: string;
  readonly deadlineAt: string;
}

export interface JobStatus extends PublicJob {
  readonly modelUrl: string | null;
  readonly failure: { code: string; message: string; retryable: boolean } | null;
}

async function call<T>(input: string, init: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = undefined;
  }
  return parseEnvelope<T>(body);
}

export function uploadInput(image: Blob): Promise<{ inputKey: string }> {
  const form = new FormData();
  form.append("image", image, "drawing.jpg");
  return call("/api/uploads", { method: "POST", body: form });
}

export function createJob(input: { inputKey: string; textureResolution: 512 | 1024; disclosureAccepted: boolean }) {
  return call<{ job: PublicJob; accessToken: string }>("/api/jobs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function getJob(id: string, token: string): Promise<JobStatus> {
  return call<JobStatus>(`/api/jobs/${encodeURIComponent(id)}`, { headers: { authorization: `Bearer ${token}` } });
}

export function cancelJob(id: string, token: string): Promise<{ id: string; status: string }> {
  return call(`/api/jobs/${encodeURIComponent(id)}`, { method: "DELETE", headers: { authorization: `Bearer ${token}` } });
}
