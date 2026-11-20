// DOM wiring for input: keys, taps and clicks, and swipes. Gestures are classified by input.ts.
import { classifySwipe, intentForKey, type Intent } from "./input";

export interface ControlHandlers {
  onIntent(intent: Intent): void;
  onPause(): void;
}

export function attachControls(target: HTMLElement, handlers: ControlHandlers): () => void {
  let start: { x: number; y: number; t: number } | null = null;

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
  };
  const onUp = (event: PointerEvent) => {
    if (!start) return;
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
  target.addEventListener("pointerup", onUp);
  return () => {
    window.removeEventListener("keydown", onKey);
    target.removeEventListener("pointerdown", onDown);
    target.removeEventListener("pointerup", onUp);
  };
}
