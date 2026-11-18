// Input mapping. Pure functions here; DOM wiring lives in attachInput (below) so tests stay DOM-free.

export type Intent = "jump" | "slide";

const JUMP_KEYS = new Set([" ", "Spacebar", "ArrowUp"]);
const SLIDE_KEYS = new Set(["ArrowDown"]);

/** Vertical movement (px) that counts as a swipe. Below this, a gesture is a tap. */
export const SWIPE_MIN_DISTANCE = 30;

export function intentForKey(key: string): Intent | null {
  if (JUMP_KEYS.has(key)) return "jump";
  if (SLIDE_KEYS.has(key)) return "slide";
  return null;
}

export interface Gesture {
  readonly dx: number;
  readonly dy: number;
  readonly durationMs: number;
}

/**
 * A downward swipe slides; anything else (a tap, a horizontal drag, or an upward move)
 * jumps. A swipe must be mostly vertical and long enough to count.
 */
export function classifySwipe(gesture: Gesture): Intent {
  const verticalDown = gesture.dy >= SWIPE_MIN_DISTANCE;
  const mostlyVertical = gesture.dy > Math.abs(gesture.dx) * 2;
  return verticalDown && mostlyVertical ? "slide" : "jump";
}
