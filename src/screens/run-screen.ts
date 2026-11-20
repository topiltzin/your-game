// Run screen: mounts the game canvas, starts a run, and maps game events to effects (FR-022).
import { CONFIG } from "../game/config";
import type { CharacterMetrics } from "../game/character-metrics";
import { attachControls } from "../game/controls";
import { ParticlePool } from "../game/effects/particles";
import { GameRenderer } from "../game/renderer";
import { RunSession, type RunEvent } from "../game/run";
import { startLoop, type LoopHandle } from "../game/loop";
import { prefersReducedMotion } from "../ui/reduced-motion";

export interface RunHandlers {
  onEnd(distance: number): void;
}

export function mountRunScreen(
  root: HTMLElement,
  sprite: HTMLImageElement,
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
      <div class="hud"><span id="distance">0</span><button class="button" id="pause" type="button">Pause</button></div>
      <p class="hint">Tap or Space to jump. Swipe down or ↓ to slide.</p>
    </section>`;
  const canvas = root.querySelector<HTMLCanvasElement>("#game")!;
  const distanceEl = root.querySelector<HTMLSpanElement>("#distance")!;
  const pauseBtn = root.querySelector<HTMLButtonElement>("#pause")!;
  resize(canvas);

  const particles = new ParticlePool(120, { enabled: !reducedMotion });
  const renderer = new GameRenderer(canvas, { sprite, metrics, reducedMotion });
  let finished = false;

  const onEvent = (event: RunEvent) => {
    const runner = session.runnerState;
    if (event.type === "land" || event.type === "jump") burst(particles, 6, 0, runner.y);
    if (event.type === "slide") burst(particles, 3, event.distance, 0);
    if (event.type === "milestone") {
      burst(particles, 12, event.distance, 60, "accent");
      if (!reducedMotion) pulse(distanceEl);
    }
    if (event.type === "crash") {
      burst(particles, 24, event.distance, 40, "accent");
      finish(session.distance);
    }
  };
  const session = new RunSession({ seed: Date.now() % 100000, metrics, onEvent });
  const cue = root.querySelector<HTMLDivElement>("#cue")!;

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
    particles.update(1 / CONFIG.TICK_HZ);
    renderer.draw(session, particles);
    distanceEl.textContent = `${Math.floor(session.distance)} m`;
  });

  function finish(distance: number) {
    if (finished) return;
    finished = true;
    loop.stop();
    controls();
    handlers.onEnd(distance);
  }

  return () => {
    if (!finished) {
      finished = true;
      loop.stop();
      controls();
    }
  };
}

function resize(canvas: HTMLCanvasElement): void {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(canvas.clientWidth * dpr) || 720;
  canvas.height = Math.round(canvas.clientHeight * dpr) || 1280;
}

/** Brief scale bump on the distance readout when a milestone is passed. Transform only. */
function pulse(element: HTMLElement): void {
  element.animate(
    [{ transform: "scale(1)" }, { transform: "scale(1.14)" }, { transform: "scale(1)" }],
    { duration: 420, easing: "cubic-bezier(0.23, 1, 0.32, 1)" },
  );
}

function burst(particles: ParticlePool, count: number, x: number, y: number, color: "ink" | "accent" = "ink"): void {
  for (let i = 0; i < count; i++) {
    particles.spawn({ x, y, vx: (Math.random() - 0.5) * 300, vy: Math.random() * 260, life: 0.5, color });
  }
}
