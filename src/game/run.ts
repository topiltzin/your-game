import { CONFIG } from "./config";
import type { CharacterMetrics } from "./character-metrics";
import { collides } from "./collision";
import { generateObstacles, type Obstacle } from "./obstacles";
import { createRng, type Rng } from "./rng";
import { createRunner, requestJump, requestSlide, stepRunner, type RunnerState } from "./physics";
import { coinsFor, collectCoins, type Coin } from "./coins";

export type RunEventType = "jump" | "land" | "slide" | "hit" | "crash" | "milestone" | "coin";
export interface RunEvent {
  readonly type: RunEventType;
  readonly distance: number;
}
export type RunPhase = "idle" | "running" | "paused" | "ended";

export interface RunOptions {
  readonly seed: number;
  readonly metrics: CharacterMetrics;
  readonly onEvent?: (event: RunEvent) => void;
}

const DT = 1 / CONFIG.TICK_HZ;
const OBSTACLE_BATCH = 20;
/** Generate obstacles this far ahead of the runner. */
const LOOKAHEAD = 2000;

/** Speed after `elapsedSeconds` of running: starts at START_SPEED, ramps, capped at MAX_SPEED (FR-018). */
export function speedAt(elapsedSeconds: number): number {
  return Math.min(CONFIG.MAX_SPEED, CONFIG.START_SPEED + CONFIG.SPEED_RAMP_PER_SECOND * elapsedSeconds);
}

/** How many milestone thresholds were crossed moving from `prev` to `next` distance. */
export function milestonesCrossed(prev: number, next: number): number {
  return Math.floor(next / CONFIG.MILESTONE_EVERY) - Math.floor(prev / CONFIG.MILESTONE_EVERY);
}

/**
 * One run of Sketch Runner. Fixed-step: `advance(seconds)` converts wall time into whole ticks
 * of 1/TICK_HZ, so pausing never advances distance. Pure game logic, no DOM access.
 */
export class RunSession {
  state: RunPhase = "idle";
  distance = 0;
  speed: number = CONFIG.START_SPEED;
  ticks = 0;
  /** Hits left. The run ends when a hit lands with none to spare. */
  lives: number = CONFIG.LIVES;

  private runner: RunnerState = createRunner();
  private obstacles: Obstacle[] = [];
  private coinList: Coin[] = [];
  private coinTotal = 0;
  private accumulator = 0;
  private elapsed = 0;
  /** Seconds of protection left after a hit. */
  private protection = 0;
  /** Seconds since a jump was pressed in the air, or null when none is waiting. */
  private bufferedJumpAge: number | null = null;
  private readonly rng: Rng;
  private readonly metrics: CharacterMetrics;
  private readonly onEvent: (event: RunEvent) => void;

  constructor(options: RunOptions) {
    this.rng = createRng(options.seed);
    this.metrics = options.metrics;
    this.onEvent = options.onEvent ?? (() => undefined);
  }

  start(): void {
    if (this.state !== "idle") return;
    this.state = "running";
    this.obstacles = generateObstacles(this.rng, this.metrics, OBSTACLE_BATCH);
  }

  pause(): void {
    if (this.state === "running") this.state = "paused";
  }

  resume(): void {
    if (this.state === "paused") this.state = "running";
  }

  jump(): void {
    const before = this.runner.mode;
    this.runner = requestJump(this.runner);
    if (before !== "jumping" && this.runner.mode === "jumping") this.emit("jump");
    // Pressed in the air: remember it, so a press a hair early still counts when the runner lands.
    else if (before === "jumping") this.bufferedJumpAge = 0;
  }

  /** True for a moment after a hit, while obstacles cannot hurt. */
  get invulnerable(): boolean {
    return this.protection > 0;
  }

  slide(): void {
    const before = this.runner.mode;
    this.runner = requestSlide(this.runner);
    if (before !== "sliding" && this.runner.mode === "sliding") this.emit("slide");
  }

  get runnerState(): RunnerState {
    return this.runner;
  }

  /** Coins collected this run: the score next to distance. */
  get coinsCollected(): number {
    return this.coinTotal;
  }

  /** Coins still ahead of the runner, for drawing. */
  upcomingCoins(): readonly Coin[] {
    const from = this.distance - 200;
    const to = this.distance + 3000;
    return this.coinList.filter((c) => c.x >= from && c.x <= to);
  }

  /** Obstacles near or ahead of the runner, in world order, for drawing. */
  upcoming(): readonly Obstacle[] {
    const from = this.distance - 200;
    const to = this.distance + 3000;
    return this.obstacles.filter((o) => o.x + o.width >= from && o.x <= to);
  }

  /** Advance by wall-clock seconds, in whole fixed ticks. */
  advance(seconds: number): void {
    if (this.state !== "running") return;
    this.accumulator += seconds;
    while (this.accumulator >= DT && this.state === "running") {
      this.accumulator -= DT;
      this.tick();
    }
  }

  private tick(): void {
    this.ticks++;
    this.elapsed += DT;
    const previousDistance = this.distance;

    const step = stepRunner(this.runner, DT);
    this.runner = step.state;
    if (step.landed) {
      this.emit("land");
      const buffered = this.bufferedJumpAge !== null && this.bufferedJumpAge <= CONFIG.JUMP_BUFFER_SECONDS;
      this.bufferedJumpAge = null;
      if (buffered) this.jump();
    }
    this.bufferedJumpAge = this.bufferedJumpAge === null ? null : this.bufferedJumpAge + DT;
    this.protection = Math.max(0, this.protection - DT);

    this.speed = speedAt(this.elapsed);
    this.distance += this.speed * DT;
    for (let i = milestonesCrossed(previousDistance, this.distance); i > 0; i--) {
      this.emit("milestone");
    }

    this.collectCoinsNow();
    this.extendObstacles();
    if (this.protection <= 0 && this.hasCollision()) this.takeHit();
  }

  /** A coin is taken when the runner's body passes through it, so a clean jump over a gap collects its arc. */
  private collectCoinsNow(): void {
    const runnerX = this.distance + CONFIG.RUNNER_X;
    const bodyCentre = this.runner.y + this.metrics.heightUnits / 2;
    const result = collectCoins(this.coinList, runnerX, bodyCentre);
    this.coinList = result.remaining;
    for (let i = 0; i < result.collected; i++) {
      this.coinTotal += 1;
      this.emit("coin");
    }
  }

  /** A hit costs a life and grants a protected moment; the last life ends the run. */
  private takeHit(): void {
    this.lives -= 1;
    if (this.lives <= 0) {
      this.state = "ended";
      this.emit("crash");
      return;
    }
    this.protection = CONFIG.INVULN_SECONDS;
    this.emit("hit");
  }

  private hasCollision(): boolean {
    const runnerX = this.distance + CONFIG.RUNNER_X;
    return this.obstacles.some((o) => collides(this.runner, this.metrics, o, runnerX));
  }

  private extendObstacles(): void {
    const reach = this.distance + CONFIG.RUNNER_X + LOOKAHEAD;
    while (this.obstacles.length === 0 || this.lastObstacleX() < reach) {
      const startX = this.obstacles.length === 0 ? CONFIG.FIRST_OBSTACLE_X : this.lastObstacleX() + CONFIG.MAX_SPACING;
      const batch = generateObstacles(this.rng, this.metrics, OBSTACLE_BATCH, startX);
      this.obstacles.push(...batch);
      this.coinList.push(...batch.flatMap((o) => coinsFor(o, this.rng.next())));
    }
  }

  private lastObstacleX(): number {
    return this.obstacles[this.obstacles.length - 1]?.x ?? 0;
  }

  private emit(type: RunEventType): void {
    this.onEvent({ type, distance: this.distance });
  }
}
