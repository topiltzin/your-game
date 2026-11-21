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
import type { CharacterMetrics } from "./game/character-metrics";
import type { RunnerSource } from "./render/run-scene";
import { presetById, presetMetrics, renderPreset } from "./game/presets";

/** Preset pixel size on the runner sprite, and its colours (the same palette as the stylesheet). */
const PRESET_SPRITE_CELL = 16;
const PRESET_INK = "#3c3c3c";
const PRESET_PAPER = "#f7f7f7";
const DEFAULT_CHOICE: ModeChoice = { presentation: "2d", modelUrl: null, presetId: null };

const root = document.getElementById("app");
if (!root) throw new Error("#app missing");
const screen: HTMLElement = root;

let character: CharacterReady | null = null;
/** The last choice made on the mode screen, so Play again uses the same hero. */
let runChoice: ModeChoice | null = null;
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
  runChoice = choice;
  const { source, metrics } = runSetup(choice, current);
  void show(() => {
    stopCurrent = mountRunScreen(screen, source, metrics, { onEnd: (distance) => toSummary(distance) });
  });
}

/** The runner's picture and size for a choice: a preset, the 3D snapshot, or the player's sketch. */
function runSetup(choice: ModeChoice, current: CharacterReady): { source: RunnerSource; metrics: CharacterMetrics } {
  const preset = choice.presentation === "preset" && choice.presetId ? presetById(choice.presetId) : null;
  if (preset) {
    const canvas = renderPreset(preset, PRESET_SPRITE_CELL, PRESET_INK, PRESET_PAPER);
    return { source: { kind: "sprite", image: imageFrom(canvas.toDataURL("image/png")) }, metrics: presetMetrics(preset) };
  }
  if (choice.presentation === "3d" && choice.modelUrl) {
    return { source: { kind: "model", url: choice.modelUrl }, metrics: current.metrics };
  }
  return { source: { kind: "sprite", image: imageFrom(current.sketchUrl) }, metrics: current.metrics };
}

function imageFrom(src: string): HTMLImageElement {
  const image = new Image();
  image.src = src;
  return image;
}

function toSummary(distance: number): void {
  void show(() =>
    mountSummaryScreen(screen, distance, {
      onPlayAgain: () => {
        const current = character;
        if (!current) return toUpload();
        const { source, metrics } = runSetup(runChoice ?? DEFAULT_CHOICE, current);
        void show(() => {
          stopCurrent = mountRunScreen(screen, source, metrics, { onEnd: (d) => toSummary(d) });
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
