// Tuning constants. Reference and test oracle: specs/001-sketch-runner-3d/contracts/game-rules.md
export const CONFIG = Object.freeze({
  TICK_HZ: 60,
  GRAVITY: 2600,
  JUMP_VELOCITY: 980,
  SLIDE_DURATION: 0.65,
  SLIDE_HEIGHT_FACTOR: 0.45,
  START_SPEED: 300,
  MAX_SPEED: 820,
  SPEED_RAMP_PER_SECOND: 6,
  CHARACTER_HEIGHT_MIN: 90,
  CHARACTER_HEIGHT_MAX: 260,
  CHARACTER_WIDTH_MIN: 60,
  CHARACTER_WIDTH_MAX: 200,
  CHARACTER_BASE_HEIGHT: 150,
  INPUT_LATENCY_TARGET_MS: 100,

  // Derived or supporting values (not in the contract table, documented in game-rules.md "Generator").
  /** Screen x of the runner. Obstacles scroll toward it. */
  RUNNER_X: 200,
  /** Airborne height at which a ground gap is cleared. */
  CLEAR_HEIGHT: 40,
  MIN_SPACING: 420,
  MAX_SPACING: 760,
  FIRST_OBSTACLE_X: 1100,
  MILESTONE_EVERY: 500,
  /** Hits the runner can take before the run ends. */
  LIVES: 3,
  /** Every this many units of distance earns one extra life, up to MAX_LIVES. */
  BONUS_LIFE_EVERY: 3000,
  MAX_LIVES: 5,
  /** Seconds after a hit when obstacles cannot hurt, so one mistake never costs two lives. */
  INVULN_SECONDS: 1.2,
  /** A jump pressed this long before landing is remembered and fires on landing. */
  JUMP_BUFFER_SECONDS: 0.15,
});
