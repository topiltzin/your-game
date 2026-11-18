// Screen transitions via the Web Animations API: transform and opacity only, 150-300 ms,
// strong ease-out. Reduced motion swaps movement for a plain fade.
import { prefersReducedMotion } from "./reduced-motion";

const EASE_OUT = "cubic-bezier(0.23, 1, 0.32, 1)";

export async function enter(element: HTMLElement): Promise<void> {
  const from = prefersReducedMotion() ? { opacity: 0 } : { opacity: 0, transform: "scale(0.95)" };
  const to = prefersReducedMotion() ? { opacity: 1 } : { opacity: 1, transform: "scale(1)" };
  await element.animate([from, to], { duration: 260, easing: EASE_OUT, fill: "both" }).finished;
}

export async function leave(element: HTMLElement): Promise<void> {
  await element.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 150, easing: "ease-out", fill: "both" }).finished;
}
