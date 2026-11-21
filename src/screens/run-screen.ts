// Run screen: a 3D run. Starts on the first tap or key press, maps game events to feedback (FR-022).
import type { CharacterMetrics } from "../game/character-metrics";
import { attachControls } from "../game/controls";
import { RunSession, type RunEvent } from "../game/run";
import { startLoop, type LoopHandle } from "../game/loop";
import { RunScene, type RunnerSource } from "../render/run-scene";
import { prefersReducedMotion } from "../ui/reduced-motion";

export interface RunHandlers {
  onEnd(distance: number, coins: number): void;
}

export function mountRunScreen(
  root: HTMLElement,
  source: RunnerSource,
  metrics: CharacterMetrics,
  handlers: RunHandlers,
): () => void {
  const reducedMotion = prefersReducedMotion();
  root.innerHTML = `
    <section class="run" aria-label="Sketch Runner">
      <canvas id="game" aria-label="Game field"></canvas>
      <div class="run-cue" id="cue">
        <p class="wordmark">Sketch Runner</p>
        <p class="display">Ready?</p>
        <ul class="controls" aria-label="Controls">
          <li><kbd>Tap</kbd> or <kbd>Space</kbd> to jump</li>
          <li><kbd>↓</kbd> or swipe down to slide</li>
        </ul>
      </div>
      <div class="hud">
        <div class="hud-score">
          <span id="distance" class="hud-distance">0 m</span>
          <span class="hud-coins"><span class="coin-dot" aria-hidden="true"></span><span id="coins">0</span></span>
        </div>
        <button class="button" id="pause" type="button">Pause</button>
      </div>
      <p class="hint">Tap or Space to jump. Swipe down or ↓ to slide.</p>
    </section>`;
  const canvas = root.querySelector<HTMLCanvasElement>("#game")!;
  const distanceEl = root.querySelector<HTMLSpanElement>("#distance")!;
  const coinsEl = root.querySelector<HTMLSpanElement>("#coins")!;
  const pauseBtn = root.querySelector<HTMLButtonElement>("#pause")!;
  const cue = root.querySelector<HTMLDivElement>("#cue")!;

  const scene = new RunScene(canvas, metrics, source);
  const fit = () => scene.resize(canvas.clientWidth || 720, canvas.clientHeight || 1280);
  fit();
  window.addEventListener("resize", fit);

  let finished = false;
  const onEvent = (event: RunEvent) => {
    if (event.type === "milestone" && !reducedMotion) pulse(distanceEl);
    if (event.type === "coin" && !reducedMotion) pulse(coinsEl);
    if (event.type === "crash") finish(session.distance);
  };
  const session = new RunSession({ seed: Date.now() % 100000, metrics, onEvent });

  const controls = attachControls(root, {
    onIntent(intent) {
      if (session.state === "idle") beginRun();
      if (session.state !== "running") return;
      if (intent === "jump") session.jump();
      else session.slide();
    },
    onPause() {
      togglePause();
    },
  });
  pauseBtn.addEventListener("click", togglePause);

  /** The first tap or key press starts the run, so the player is never caught off guard. */
  function beginRun() {
    session.start();
    cue.classList.add("is-hidden");
  }

  function togglePause() {
    if (session.state === "idle") return;
    if (session.state === "running") session.pause();
    else session.resume();
    pauseBtn.textContent = session.state === "paused" ? "Resume" : "Pause";
  }

  const loop: LoopHandle = startLoop(session, () => {
    scene.sync(session);
    scene.render();
    distanceEl.textContent = `${Math.floor(session.distance)} m`;
    coinsEl.textContent = String(session.coinsCollected);
  });

  function finish(distance: number) {
    if (finished) return;
    finished = true;
    loop.stop();
    controls();
    window.removeEventListener("resize", fit);
    scene.dispose();
    handlers.onEnd(distance, session.coinsCollected);
  }

  return () => {
    if (!finished) {
      finished = true;
      loop.stop();
      controls();
      window.removeEventListener("resize", fit);
      scene.dispose();
    }
  };
}

/** Brief scale bump on the distance readout when a milestone is passed. Transform only. */
function pulse(element: HTMLElement): void {
  element.animate(
    [{ transform: "scale(1)" }, { transform: "scale(1.14)" }, { transform: "scale(1)" }],
    { duration: 420, easing: "cubic-bezier(0.23, 1, 0.32, 1)" },
  );
}
