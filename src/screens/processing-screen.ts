// Processing screen: animated progress while the 3D model is made (FR-004, FR-005), with cancel
// and retry. Polls every 5 s, backing off to 10 s (contracts/api.md).
import { cancelJob, getJob, type JobStatus } from "../api/client";
import { ApiError } from "../api/envelope";

export interface ProcessingHandlers {
  onReady(modelUrl: string): void;
  onFailed(message: string, retryable: boolean): void;
  onCancelled(): void;
}

const POLL_MS = 5000;
const POLL_MAX_MS = 10000;
/** A phone that locks or drops signal can miss several polls. The job keeps running on the worker, so keep trying for about 5 minutes. */
const MAX_NETWORK_RETRIES = 30;

export function mountProcessingScreen(root: HTMLElement, jobId: string, token: string, handlers: ProcessingHandlers): () => void {
  root.innerHTML = `
    <section class="panel center" aria-labelledby="title">
      <div class="sketch-loader" aria-hidden="true"><span></span><span></span><span></span></div>
      <h1 id="title" class="display">Drawing your hero in 3D</h1>
      <p class="lede" id="status" role="status" aria-live="polite">Sending your sketch…</p>
      <div class="actions"><button class="button" id="cancel" type="button">Cancel</button></div>
    </section>`;
  const status = root.querySelector<HTMLParagraphElement>("#status")!;
  let timer: number | undefined;
  let interval = POLL_MS;
  let stopped = false;
  let networkFailures = 0;

  const poll = async () => {
    try {
      const job = await getJob(jobId, token);
      if (stopped) return;
      networkFailures = 0;
      if (job.status === "ready" && job.modelUrl) return handlers.onReady(job.modelUrl);
      if (job.status === "failed" || job.status === "timed_out") return finishWith(job);
      if (job.status === "cancelled") return handlers.onCancelled();
      status.textContent = "Still drawing… this can take a few minutes.";
      interval = Math.min(POLL_MAX_MS, interval + 1000);
      timer = window.setTimeout(poll, interval);
    } catch (error) {
      if (stopped) return;
      if (error instanceof ApiError) return handlers.onFailed(error.message, error.retryable);
      // Not an API answer: the request never got a response (network drop, sleeping phone). Retry.
      networkFailures += 1;
      if (networkFailures > MAX_NETWORK_RETRIES) {
        return handlers.onFailed("Lost the connection while checking your model. Check your signal and try again.", true);
      }
      status.textContent = "Connection dropped. Reconnecting…";
      timer = window.setTimeout(poll, interval);
    }
  };

  const finishWith = (job: JobStatus) => {
    handlers.onFailed(job.failure?.message ?? "Something went wrong. Try again.", job.failure?.retryable ?? true);
  };

  root.querySelector<HTMLButtonElement>("#cancel")!.addEventListener("click", async () => {
    try {
      await cancelJob(jobId, token);
      handlers.onCancelled();
    } catch {
      status.textContent = "Couldn't cancel just now. Try again.";
    }
  });

  timer = window.setTimeout(poll, 0);
  return () => {
    stopped = true;
    window.clearTimeout(timer);
  };
}
