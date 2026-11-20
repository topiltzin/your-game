// Mode screen: choose your hero. Options: your 2D sketch, a built-in preset character, or the
// optional 3D model (only when WebGL and the model are ready). The 3D preview loads the viewer
// lazily; its snapshot becomes the runner sprite in 3D mode.
import { createViewer, loadModelViewer, webglAvailable } from "../character/model-viewer";
import { PRESETS, renderPreset } from "../game/presets";
import { presentationAvailability, type Presentation } from "./mode-availability";

export interface ModeChoice {
  readonly presentation: Presentation;
  /** Object URL of the 3D snapshot when presentation is "3d", otherwise null. */
  readonly snapshotUrl: string | null;
  /** The chosen preset id when presentation is "preset", otherwise null. */
  readonly presetId: string | null;
}

const PREVIEW_CELL = 4;
const PRESET_INK = "#3c3c3c";
const PRESET_PAPER = "#f7f7f7";

export function mountModeScreen(
  root: HTMLElement,
  sketchUrl: string,
  modelUrl: string,
  onStart: (choice: ModeChoice) => void,
): void {
  const webgl = webglAvailable();
  const threeD = presentationAvailability({ modelStatus: "ready", webgl }, "3d");
  root.innerHTML = `
    <section class="panel" aria-labelledby="title">
      <h1 id="title" class="display">Pick your hero</h1>
      <div class="modes">
        <button class="mode-card is-selected" id="mode-2d" type="button" aria-pressed="true">
          <img src="${sketchUrl}" alt="" />
          <span>Your sketch</span>
        </button>
        <button class="mode-card" id="mode-3d" type="button" aria-pressed="false" ${threeD.available ? "" : "disabled"}>
          <span class="viewer-slot" id="viewer-slot"></span>
          <span>3D model</span>
        </button>
      </div>
      ${threeD.available ? "" : `<p class="message">${threeD.available ? "" : threeD.reason}</p>`}
      <p class="lede">Or play as a built-in character:</p>
      <div class="presets" role="group" aria-label="Built-in characters">
        ${PRESETS.map(
          (preset) => `<button class="preset-chip" type="button" data-preset="${preset.id}" aria-pressed="false">
            <span class="preset-art" data-art="${preset.id}"></span>
            <span>${preset.label}</span>
          </button>`,
        ).join("")}
      </div>
      <div class="actions"><button class="button button-primary" id="start" type="button">Start running</button></div>
    </section>`;

  for (const preset of PRESETS) {
    const slot = root.querySelector<HTMLSpanElement>(`[data-art="${preset.id}"]`);
    slot?.append(renderPreset(preset, PREVIEW_CELL, PRESET_INK, PRESET_PAPER));
  }

  let choice: Presentation = "2d";
  let presetId: string | null = null;
  let snapshotUrl: string | null = null;
  const card2d = root.querySelector<HTMLButtonElement>("#mode-2d")!;
  const card3d = root.querySelector<HTMLButtonElement>("#mode-3d")!;
  const chips = [...root.querySelectorAll<HTMLButtonElement>(".preset-chip")];

  const select = (next: Presentation, nextPreset: string | null = null) => {
    choice = next;
    presetId = next === "preset" ? nextPreset : null;
    card2d.classList.toggle("is-selected", next === "2d");
    card3d.classList.toggle("is-selected", next === "3d");
    card2d.setAttribute("aria-pressed", String(next === "2d"));
    card3d.setAttribute("aria-pressed", String(next === "3d"));
    for (const chip of chips) {
      const selected = next === "preset" && chip.dataset["preset"] === nextPreset;
      chip.classList.toggle("is-selected", selected);
      chip.setAttribute("aria-pressed", String(selected));
    }
  };
  card2d.addEventListener("click", () => select("2d"));
  for (const chip of chips) {
    chip.addEventListener("click", () => select("preset", chip.dataset["preset"] ?? null));
  }

  if (threeD.available) {
    card3d.addEventListener("click", async () => {
      select("3d");
      const slot = root.querySelector<HTMLSpanElement>("#viewer-slot")!;
      if (slot.childElementCount === 0) {
        await loadModelViewer();
        const viewer = createViewer(modelUrl, "Your 3D character");
        slot.append(viewer);
        viewer.addEventListener("load", async () => {
          // A snapshot taken at the load event can be black: wait for lit frames to be drawn first.
          await nextFrames(2);
          const blob = await (viewer as HTMLElement & { toBlob(o: { mimeType: string }): Promise<Blob> }).toBlob({ mimeType: "image/png" });
          snapshotUrl = URL.createObjectURL(blob);
        }, { once: true });
      }
    });
  }

  root.querySelector<HTMLButtonElement>("#start")!.addEventListener("click", () => {
    onStart({
      presentation: choice,
      snapshotUrl: choice === "3d" ? snapshotUrl : null,
      presetId,
    });
  });
}

/** Resolves after `count` animation frames, so the browser has drawn them. */
function nextFrames(count: number): Promise<void> {
  return new Promise((resolve) => {
    const step = (remaining: number) => (remaining <= 0 ? resolve() : requestAnimationFrame(() => step(remaining - 1)));
    step(count);
  });
}
