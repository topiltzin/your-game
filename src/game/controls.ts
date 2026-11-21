// DOM wiring for input: keys, taps and clicks, and swipes. Gestures are classified by input.ts.
import { classifySwipe, intentForKey, SWIPE_MIN_DISTANCE, type Intent } from "./input";

export interface ControlHandlers {
  onIntent(intent: Intent): void;
  onPause(): void;
}

export function attachControls(target: HTMLElement, handlers: ControlHandlers): () => void {
  let start: { x: number; y: number; t: number } | null = null;
  /** True once a swipe already slid mid-gesture, so lifting the finger does not also jump. */
  let slid = false;

  const onKey = (event: KeyboardEvent) => {
    if (event.key === "Escape" || event.key === "p" || event.key === "P") {
      handlers.onPause();
      return;
    }
    const intent = intentForKey(event.key);
    if (intent) {
      event.preventDefault();
      handlers.onIntent(intent);
    }
  };
  const onDown = (event: PointerEvent) => {
    start = { x: event.clientX, y: event.clientY, t: performance.now() };
    slid = false;
  };
  // A downward swipe slides as soon as it is long enough, without waiting for the finger to lift.
  const onMove = (event: PointerEvent) => {
    if (!start || slid) return;
    const dy = event.clientY - start.y;
    const dx = event.clientX - start.x;
    if (dy >= SWIPE_MIN_DISTANCE && dy > Math.abs(dx) * 2) {
      slid = true;
      handlers.onIntent("slide");
    }
  };
  const onUp = (event: PointerEvent) => {
    // A tap on a button (Pause) is for that button, not a jump.
    if (event.target instanceof Element && event.target.closest("button")) {
      start = null;
      return;
    }
    if (!start) return;
    if (slid) {
      start = null;
      return;
    }
    const gesture = {
      dx: event.clientX - start.x,
      dy: event.clientY - start.y,
      durationMs: performance.now() - start.t,
    };
    start = null;
    handlers.onIntent(classifySwipe(gesture));
  };

  window.addEventListener("keydown", onKey);
  target.addEventListener("pointerdown", onDown);
  target.addEventListener("pointermove", onMove);
  target.addEventListener("pointerup", onUp);
  return () => {
    window.removeEventListener("keydown", onKey);
    target.removeEventListener("pointerdown", onDown);
    target.removeEventListener("pointermove", onMove);
    target.removeEventListener("pointerup", onUp);
  };
}
