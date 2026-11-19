// Summary screen: distance reached, best score on this device (FR-019, FR-026), and next actions.
import { recordBest } from "../game/best-score";
import { localStore } from "../ui/store";
import { prefersReducedMotion } from "../ui/reduced-motion";

export interface SummaryHandlers {
  onPlayAgain(): void;
  onNewCharacter(): void;
}

const COUNT_UP_MS = 700;

export function mountSummaryScreen(root: HTMLElement, distance: number, handlers: SummaryHandlers): void {
  const { isNewBest } = recordBest(localStore(), distance, new Date());
  const meters = Math.floor(distance);
  root.innerHTML = `
    <section class="panel center" aria-labelledby="title">
      <p class="eyebrow">${isNewBest ? "New best" : "Run over"}</p>
      <h1 id="title" class="display score" aria-label="Distance ${meters} meters"><span id="score">${meters}</span><span class="unit">m</span></h1>
      <div class="actions">
        <button class="button button-primary" id="again" type="button">Run again</button>
        <button class="button" id="new" type="button">New character</button>
      </div>
    </section>`;
  root.querySelector<HTMLButtonElement>("#again")!.addEventListener("click", handlers.onPlayAgain);
  root.querySelector<HTMLButtonElement>("#new")!.addEventListener("click", handlers.onNewCharacter);
  countUp(root.querySelector<HTMLElement>("#score")!, meters, COUNT_UP_MS);
}

/** Counts from 0 to the target with an ease-out curve. Reduced motion shows the final value at once. */
function countUp(element: HTMLElement, target: number, durationMs: number): void {
  if (prefersReducedMotion() || target <= 0) {
    element.textContent = String(target);
    return;
  }
  element.textContent = "0";
  const start = performance.now();
  const frame = (now: number) => {
    const progress = Math.min(1, (now - start) / durationMs);
    const eased = 1 - (1 - progress) ** 3;
    element.textContent = String(Math.round(target * eased));
    if (progress < 1) requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
