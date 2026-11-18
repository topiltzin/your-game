// requestAnimationFrame driver. Feeds wall-clock time to the RunSession (which turns it into fixed
// ticks) and pauses when the page is hidden (FR-020). Large gaps are capped, so a stalled tab
// cannot skip obstacles.
import type { RunSession } from "./run";

const MAX_FRAME_SECONDS = 0.1;

export interface LoopHandle {
  stop(): void;
}

export function startLoop(run: RunSession, onFrame: () => void): LoopHandle {
  let last: number | null = null;
  let frame = 0;
  let stopped = false;

  const tick = (now: number) => {
    if (stopped) return;
    const dt = last === null ? 0 : Math.min(MAX_FRAME_SECONDS, (now - last) / 1000);
    last = now;
    run.advance(dt);
    onFrame();
    frame = requestAnimationFrame(tick);
  };

  const onVisibility = () => {
    if (document.hidden) run.pause();
  };
  document.addEventListener("visibilitychange", onVisibility);
  frame = requestAnimationFrame(tick);

  return {
    stop() {
      stopped = true;
      cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", onVisibility);
    },
  };
}
