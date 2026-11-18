// App bootstrap and flow: upload → processing → mode → run → summary. One screen at a time.
import "./styles/main.css";
import { createJob, uploadInput } from "./api/client";
import { ApiError } from "./api/envelope";
import { saveJobToken } from "./character/job-session";
import type { CharacterReady } from "./screens/upload-screen";
import { mountUploadScreen } from "./screens/upload-screen";
import { mountProcessingScreen } from "./screens/processing-screen";
import { mountModeScreen, type ModeChoice } from "./screens/mode-screen";
import { mountRunScreen } from "./screens/run-screen";
import { mountSummaryScreen } from "./screens/summary-screen";
import { enter, leave } from "./ui/transitions";

const root = document.getElementById("app");
if (!root) throw new Error("#app missing");
const screen: HTMLElement = root;

let character: CharacterReady | null = null;
let stopCurrent: (() => void) | null = null;

async function show(mount: () => void): Promise<void> {
  stopCurrent?.();
  stopCurrent = null;
  await leave(screen).catch(() => undefined);
  mount();
  const first = screen.firstElementChild;
  if (first instanceof HTMLElement) await enter(first).catch(() => undefined);
}

function toUpload(): void {
  void show(() => mountUploadScreen(screen, (ready) => void submit(ready)));
}

async function submit(ready: CharacterReady): Promise<void> {
  character = ready;
  await show(() => {
    screen.innerHTML = `<section class="panel center"><p class="lede">Sending your sketch…</p></section>`;
  });
  try {
    const { inputKey } = await uploadInput(ready.blob);
    const { job, accessToken } = await createJob({ inputKey, textureResolution: 1024, disclosureAccepted: true });
    saveJobToken(job.id, accessToken);
    toProcessing(job.id, accessToken);
  } catch (error) {
    toFailure(error instanceof ApiError ? error.message : "Something went wrong. Try again.");
  }
}

function toProcessing(jobId: string, token: string): void {
  void show(() => {
    stopCurrent = mountProcessingScreen(screen, jobId, token, {
      onReady: (modelUrl) => toMode(modelUrl),
      onFailed: (message) => toFailure(message),
      onCancelled: () => toUpload(),
    });
  });
}

function toMode(modelUrl: string): void {
  const current = character;
  if (!current) return toUpload();
  void show(() => mountModeScreen(screen, current.sketchUrl, modelUrl, (choice) => toRun(choice)));
}

function toRun(choice: ModeChoice): void {
  const current = character;
  if (!current) return toUpload();
  const sprite = new Image();
  sprite.src = choice.presentation === "3d" && choice.snapshotUrl ? choice.snapshotUrl : current.sketchUrl;
  void show(() => {
    stopCurrent = mountRunScreen(screen, sprite, current.metrics, { onEnd: (distance) => toSummary(distance) });
  });
}

function toSummary(distance: number): void {
  void show(() =>
    mountSummaryScreen(screen, distance, {
      onPlayAgain: () => {
        const current = character;
        if (!current) return toUpload();
        const sprite = new Image();
        sprite.src = current.sketchUrl;
        void show(() => {
          stopCurrent = mountRunScreen(screen, sprite, current.metrics, { onEnd: (d) => toSummary(d) });
        });
      },
      onNewCharacter: () => toUpload(),
    }),
  );
}

function toFailure(message: string): void {
  void show(() => {
    screen.innerHTML = `
      <section class="panel center" aria-labelledby="title">
        <h1 id="title" class="display">Not this time</h1>
        <p class="lede" role="alert">${escapeHtml(message)}</p>
        <div class="actions">
          <button class="button button-primary" id="retry" type="button">Try again</button>
        </div>
      </section>`;
    screen.querySelector<HTMLButtonElement>("#retry")!.addEventListener("click", () => toUpload());
  });
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);
}

toUpload();
