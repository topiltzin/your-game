// Start screen: upload or draw a character, preview its outline, accept the disclosure (FR-007),
// and show the device's best distance (T105).
import { canvasToJpeg, fitToCanvas, loadBitmap, validateImageFile } from "../character/image-input";
import { measureCharacter } from "../character/measure";
import type { CappedMetrics } from "../character/size-cap";
import { getBest } from "../game/best-score";
import { localStore } from "../ui/store";

export interface CharacterReady {
  readonly blob: Blob;
  readonly sketchUrl: string;
  readonly metrics: CappedMetrics["metrics"];
  readonly sizeCapped: boolean;
}

const DRAW_SIDE = 512;

export function mountUploadScreen(root: HTMLElement, onReady: (character: CharacterReady) => void): void {
  const best = getBest(localStore());
  root.innerHTML = `
    <section class="panel" aria-labelledby="title">
      <h1 id="title" class="display">Draw a hero. Run with it.</h1>
      <p class="lede">Upload a sketch or draw one. We turn it into a 3D model you can run as.</p>
      ${best ? `<p class="best">Best run: <strong>${Math.floor(best.distance)}</strong></p>` : ""}
      <div class="actions">
        <label class="button button-primary">
          <input id="file" type="file" accept="image/jpeg,image/png,image/webp,image/heic" hidden />
          Upload a sketch
        </label>
        <button class="button" id="draw-toggle" type="button">Draw one</button>
      </div>
      <div id="draw" class="draw" hidden>
        <canvas id="pad" width="${DRAW_SIDE}" height="${DRAW_SIDE}" aria-label="Drawing pad"></canvas>
        <div class="actions">
          <button class="button" id="clear" type="button">Clear</button>
          <button class="button button-primary" id="use-drawing" type="button">Use this drawing</button>
        </div>
      </div>
      <p id="message" class="message" role="status" aria-live="polite"></p>
      <div id="preview" class="preview" hidden>
        <img id="sketch" alt="Your character outline" />
        <label class="disclosure">
          <input id="disclose" type="checkbox" />
          I understand my image is sent to an external service to make the 3D model.
        </label>
        <button class="button button-primary" id="make" type="button" disabled>Make it 3D</button>
      </div>
    </section>`;

  const q = <T extends Element>(id: string) => root.querySelector<T>(`#${id}`)!;
  const message = q<HTMLParagraphElement>("message");
  const preview = q<HTMLDivElement>("preview");
  const sketch = q<HTMLImageElement>("sketch");
  const disclose = q<HTMLInputElement>("disclose");
  const make = q<HTMLButtonElement>("make");
  let pending: CharacterReady | null = null;

  const showCharacter = (blob: Blob, canvas: HTMLCanvasElement) => {
    const measured = measureCharacter(canvas);
    if (!measured) {
      message.textContent = "We couldn't find a character. Try drawing it bigger.";
      return;
    }
    const sketchUrl = URL.createObjectURL(blob);
    sketch.src = sketchUrl;
    pending = { blob, sketchUrl, metrics: measured.metrics, sizeCapped: measured.sizeCapped };
    message.textContent = measured.sizeCapped ? "We scaled your character to fit the game." : "";
    preview.hidden = false;
  };

  q<HTMLInputElement>("file").addEventListener("change", async (event) => {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const problem = validateImageFile(file);
    if (problem) {
      message.textContent = problem === "IMAGE_TOO_LARGE" ? "Keep images under 10 MB." : "Use JPEG, PNG, WebP, or HEIC.";
      return;
    }
    message.textContent = "Reading your sketch…";
    const bitmap = await loadBitmap(file);
    const canvas = fitToCanvas(bitmap, bitmap.width, bitmap.height);
    showCharacter(await canvasToJpeg(canvas), canvas);
  });

  q<HTMLButtonElement>("draw-toggle").addEventListener("click", () => {
    const draw = q<HTMLDivElement>("draw");
    draw.hidden = !draw.hidden;
  });
  attachPad(q<HTMLCanvasElement>("pad"), q<HTMLButtonElement>("clear"));
  q<HTMLButtonElement>("use-drawing").addEventListener("click", async () => {
    const pad = q<HTMLCanvasElement>("pad");
    showCharacter(await canvasToJpeg(pad), pad);
  });

  disclose.addEventListener("change", () => {
    make.disabled = !disclose.checked;
  });
  make.addEventListener("click", () => {
    if (pending && disclose.checked) onReady(pending);
  });
}

function attachPad(pad: HTMLCanvasElement, clear: HTMLButtonElement): void {
  const ctx = pad.getContext("2d")!;
  const paint = () => {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, pad.width, pad.height);
    ctx.lineWidth = 10;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#1b1b1f";
  };
  paint();
  let drawing = false;
  const at = (e: PointerEvent) => {
    const r = pad.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * pad.width, y: ((e.clientY - r.top) / r.height) * pad.height };
  };
  pad.addEventListener("pointerdown", (e) => {
    drawing = true;
    const p = at(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  });
  pad.addEventListener("pointermove", (e) => {
    if (!drawing) return;
    const p = at(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  });
  const stop = () => (drawing = false);
  pad.addEventListener("pointerup", stop);
  pad.addEventListener("pointerleave", stop);
  clear.addEventListener("click", paint);
}
