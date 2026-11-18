// Summary screen: distance reached, best score on this device (FR-019, FR-026), and next actions.
import { recordBest } from "../game/best-score";
import { localStore } from "../ui/store";

export interface SummaryHandlers {
  onPlayAgain(): void;
  onNewCharacter(): void;
}

export function mountSummaryScreen(root: HTMLElement, distance: number, handlers: SummaryHandlers): void {
  const { isNewBest } = recordBest(localStore(), distance, new Date());
  const meters = Math.floor(distance);
  root.innerHTML = `
    <section class="panel center" aria-labelledby="title">
      <p class="eyebrow">${isNewBest ? "New best" : "Run over"}</p>
      <h1 id="title" class="display score" aria-label="Distance ${meters}">${meters}</h1>
      <div class="actions">
        <button class="button button-primary" id="again" type="button">Run again</button>
        <button class="button" id="new" type="button">New character</button>
      </div>
    </section>`;
  root.querySelector<HTMLButtonElement>("#again")!.addEventListener("click", handlers.onPlayAgain);
  root.querySelector<HTMLButtonElement>("#new")!.addEventListener("click", handlers.onNewCharacter);
}
