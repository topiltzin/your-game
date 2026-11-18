// Remembers a job's access token on this device so the player can resume polling after a reload.
// Storage can be blocked, so every access is guarded and failures are silent.
const PREFIX = "sketchRunner.jobToken:";

export function saveJobToken(jobId: string, token: string): void {
  try {
    localStorage.setItem(PREFIX + jobId, token);
  } catch {
    // storage unavailable: the job can still be polled in this session
  }
}

export function readJobToken(jobId: string): string | null {
  try {
    return localStorage.getItem(PREFIX + jobId);
  } catch {
    return null;
  }
}

export function clearJobToken(jobId: string): void {
  try {
    localStorage.removeItem(PREFIX + jobId);
  } catch {
    // ignore
  }
}
