import { CONFIG } from "./config";

export type RunnerMode = "standing" | "jumping" | "sliding";

export interface RunnerState {
  readonly mode: RunnerMode;
  /** Height of the character's feet above the ground. */
  readonly y: number;
  readonly vy: number;
  /** Seconds left in the current slide (0 when not sliding). */
  readonly slideTimer: number;
}

export interface StepResult {
  readonly state: RunnerState;
  /** True on the tick the character lands. */
  readonly landed: boolean;
}

export function createRunner(): RunnerState {
  return { mode: "standing", y: 0, vy: 0, slideTimer: 0 };
}

/** Jump only from standing. Taps while sliding or jumping are ignored (edge case in spec). */
export function requestJump(state: RunnerState): RunnerState {
  if (state.mode !== "standing") return state;
  return { mode: "jumping", y: 0, vy: CONFIG.JUMP_VELOCITY, slideTimer: 0 };
}

/** Slide only from standing (on the ground). */
export function requestSlide(state: RunnerState): RunnerState {
  if (state.mode !== "standing") return state;
  return { mode: "sliding", y: 0, vy: 0, slideTimer: CONFIG.SLIDE_DURATION };
}

/** Advance the runner by dt seconds. Pure: returns a new state. */
export function stepRunner(state: RunnerState, dt: number): StepResult {
  if (state.mode === "jumping") return stepJump(state, dt);
  if (state.mode === "sliding") return stepSlide(state, dt);
  return { state, landed: false };
}

function stepJump(state: RunnerState, dt: number): StepResult {
  const vy = state.vy - CONFIG.GRAVITY * dt;
  const y = state.y + vy * dt;
  if (y > 0) return { state: { mode: "jumping", y, vy, slideTimer: 0 }, landed: false };
  return { state: createRunner(), landed: true };
}

function stepSlide(state: RunnerState, dt: number): StepResult {
  const remaining = state.slideTimer - dt;
  if (remaining > 0) return { state: { ...state, slideTimer: remaining }, landed: false };
  return { state: createRunner(), landed: false };
}
