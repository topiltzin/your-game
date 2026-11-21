// Run screen: a 3D run. Starts on the first tap or key press, maps game events to feedback (FR-022).
import type { CharacterMetrics } from "../game/character-metrics";
import { attachControls } from "../game/controls";
import { RunSession, type RunEvent } from "../game/run";
import { startLoop, type LoopHandle } from "../game/loop";
import { CONFIG } from "../game/config";
import { getBest } from "../game/best-score";
import { nextAction } from "../game/action-cue";
import { RunScene, type RunnerSource } from "../render/run-scene";
import { prefersReducedMotion } from "../ui/reduced-motion";
import { localStore } from "../ui/store";

const TOAST_MS = 1500;
/** How long the crash is shown before the summary appears. */
const CRASH_BEAT_MS = 650;
const CRASH_BEAT_REDUCED_MS = 200;

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
  const priorBest = Math.floor(getBest(localStore())?.distance ?? 0);
  root.innerHTML = `
    <section class="run" aria-label="Sketch Runner">
      <canvas id="game" aria-label="Game field"></canvas>
      <div class="run-cue" id="cue">
        <div class="cue-card">
          <p class="wordmark">Sketch Runner</p>
          <p class="display">Ready?</p>
          <ul class="controls" aria-label="Controls">
            <li><kbd>Tap</kbd> or <kbd>Space</kbd> to jump over pits</li>
            <li><kbd>↓</kbd> or swipe down to slide under bars</li>
            <li>Grab the coins in the air.</li>
          </ul>
          <p class="cue-start">Tap or press Space to start</p>
        </div>
      </div>
      <div class="hud">
        <div class="hud-score">
          <span id="distance" class="hud-distance">0 m</span>
          <span class="hud-coins"><span class="coin-dot" aria-hidden="true"></span><span id="coins">0</span></span>
          <span class="hud-lives" id="lives" role="img" aria-label="${CONFIG.LIVES} lives left">${'<span class="life"></span>'.repeat(CONFIG.LIVES)}</span>
          ${priorBest > 0 ? `<span class="hud-best">Best ${priorBest} m</span>` : ""}
        </div>
        <button class="button" id="pause" type="button">Pause</button>
      </div>
      <p class="run-toast" id="toast" role="status" aria-live="polite"></p>
      <p class="run-action" id="action" data-action="" aria-hidden="true"></p>
      <div class="run-pause" id="paused" hidden>
        <div class="cue-card">
          <p class="display">Paused</p>
          <button class="button button-primary" id="resume" type="button">Resume</button>
        </div>
      </div>
      <div class="run-flash" id="flash" aria-hidden="true"></div>
      <p class="hint">Tap or Space to jump. Swipe down or ↓ to slide.</p>
    </section>`;
  const canvas = root.querySelector<HTMLCanvasElement>("#game")!;
  const distanceEl = root.querySelector<HTMLSpanElement>("#distance")!;
  const coinsEl = root.querySelector<HTMLSpanElement>("#coins")!;
  const livesEl = root.querySelector<HTMLSpanElement>("#lives")!;
  const pauseBtn = root.querySelector<HTMLButtonElement>("#pause")!;
  const cue = root.querySelector<HTMLDivElement>("#cue")!;
  const toastEl = root.querySelector<HTMLParagraphElement>("#toast")!;
  const actionEl = root.querySelector<HTMLParagraphElement>("#action")!;
  const pausedEl = root.querySelector<HTMLDivElement>("#paused")!;
  const resumeBtn = root.querySelector<HTMLButtonElement>("#resume")!;
  const flashEl = root.querySelector<HTMLDivElement>("#flash")!;

  /** A short callout in the middle-top of the field. Opacity and transform only. */
  function toast(text: string): void {
    toastEl.textContent = text;
    const rise = reducedMotion ? "none" : "translateY(10px) scale(0.96)";
    toastEl.animate(
      [
        { opacity: 0, transform: rise },
        { opacity: 1, transform: "none", offset: 0.15 },
        { opacity: 1, transform: "none", offset: 0.75 },
        { opacity: 0, transform: "none" },
      ],
      { duration: TOAST_MS, easing: "cubic-bezier(0.23, 1, 0.32, 1)", fill: "both" },
    );
  }

  const scene = new RunScene(canvas, metrics, source);
  scene.setReducedMotion(reducedMotion);
  const fit = () => scene.resize(canvas.clientWidth || 720, canvas.clientHeight || 1280);
  fit();
  window.addEventListener("resize", fit);

  let finished = false;
  let beatBest = false;
  const onEvent = (event: RunEvent) => {
    if (event.type === "milestone") {
      toast(`${Math.floor(event.distance / CONFIG.MILESTONE_EVERY) * CONFIG.MILESTONE_EVERY} m`);
      if (!reducedMotion) pulse(distanceEl);
    }
    if (event.type === "coin" && !reducedMotion) pulse(coinsEl);
    if (event.type === "hit") hit();
    if (event.type === "crash") crash();
  };
  const session = new RunSession({ seed: Date.now() % 100000, metrics, onEvent });

  const controls = attachControls(root, {
    onIntent(intent) {
      // The first tap only starts the run, so it never costs a jump the player did not mean.
      if (session.state === "idle") return beginRun();
      if (session.state !== "running") return;
      if (intent === "jump") session.jump();
      else session.slide();
    },
    onPause() {
      togglePause();
    },
  });
  pauseBtn.addEventListener("click", togglePause);
  resumeBtn.addEventListener("click", togglePause);

  /** The first tap or key press starts the run, so the player is never caught off guard. */
  function beginRun() {
    session.start();
    cue.classList.add("is-hidden");
    toast("Go!");
  }

  function togglePause() {
    if (session.state === "idle") return;
    if (session.state === "running") session.pause();
    else session.resume();
    showPaused(session.state === "paused");
    if (session.state === "paused") resumeBtn.focus({ preventScroll: true });
  }

  /** The pause card follows the session, so a pause from a hidden tab is shown too. */
  let pausedShown = false;
  function showPaused(paused: boolean) {
    if (paused === pausedShown) return;
    pausedShown = paused;
    pausedEl.hidden = !paused;
    pauseBtn.textContent = paused ? "Resume" : "Pause";
  }

  /** A hint of what to do about the next obstacle. Written only when it changes. */
  let shownAction = "";
  function showAction() {
    const cue = session.state === "running" ? nextAction(session.upcoming(), session.distance + CONFIG.RUNNER_X, session.speed) : null;
    const key = cue?.action ?? "";
    if (key === shownAction) return;
    shownAction = key;
    actionEl.dataset["action"] = key;
    actionEl.textContent = cue ? (cue.action === "jump" ? "↑ Jump" : "↓ Slide") : "";
  }

  /** Losing a life is a short, loud moment (shake, flash, callout) and then the run goes on. */
  function hit() {
    scene.crash();
    toast(session.lives === 1 ? "Last life!" : `${session.lives} lives left`);
    if (!reducedMotion) flashEl.animate([{ opacity: 0.4 }, { opacity: 0 }], { duration: 320, easing: "ease-out" });
    showLives();
  }

  /** The life dots follow the session; spent lives turn into outlines. */
  let shownLives = -1;
  function showLives() {
    if (shownLives === session.lives) return;
    shownLives = session.lives;
    livesEl.setAttribute("aria-label", `${session.lives} lives left`);
    livesEl.querySelectorAll(".life").forEach((dot, i) => dot.classList.toggle("is-lost", i >= session.lives));
  }

  let crashTimer: number | undefined;
  /** The crash shows for a beat (shake and a flash) before the summary, so the hit reads as the cause. */
  function crash() {
    if (finished || crashTimer !== undefined) return;
    scene.crash();
    showLives();
    actionEl.textContent = "";
    if (!reducedMotion) {
      flashEl.animate([{ opacity: 0.55 }, { opacity: 0 }], { duration: 380, easing: "ease-out" });
    }
    crashTimer = window.setTimeout(() => finish(session.distance), reducedMotion ? CRASH_BEAT_REDUCED_MS : CRASH_BEAT_MS);
  }

  const loop: LoopHandle = startLoop(session, () => {
    scene.sync(session);
    scene.render();
    distanceEl.textContent = `${Math.floor(session.distance)} m`;
    coinsEl.textContent = String(session.coinsCollected);
    showPaused(session.state === "paused");
    showAction();
    if (!beatBest && priorBest > 0 && session.distance > priorBest) {
      beatBest = true;
      toast("New best!");
    }
  });

  function finish(distance: number) {
    if (finished) return;
    finished = true;
    window.clearTimeout(crashTimer);
    loop.stop();
    controls();
    window.removeEventListener("resize", fit);
    scene.dispose();
    handlers.onEnd(distance, session.coinsCollected);
  }

  return () => {
    if (!finished) {
      finished = true;
      window.clearTimeout(crashTimer);
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
