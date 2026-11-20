import { CONFIG } from "./config";
import type { CharacterMetrics } from "./character-metrics";
import { collides } from "./collision";
import { generateObstacles, type Obstacle } from "./obstacles";
import { createRng, type Rng } from "./rng";
import { createRunner, requestJump, requestSlide, stepRunner, type RunnerState } from "./physics";
import { SHOT_COOLDOWN, SHOT_OFFSET, SHOT_RANGE, SHOT_SPEED, findShotTarget, type Shot } from "./shots";

export type RunEventType = "jump" | "land" | "slide" | "crash" | "milestone" | "shot" | "hit";
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

  private runner: RunnerState = createRunner();
  private obstacles: Obstacle[] = [];
  private accumulator = 0;
  private elapsed = 0;
  private shotList: Shot[] = [];
  private shotCooldown = 0;
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
  }

  slide(): void {
    const before = this.runner.mode;
    this.runner = requestSlide(this.runner);
    if (before !== "sliding" && this.runner.mode === "sliding") this.emit("slide");
  }

  /** Fires a shot from the runner's front. Ignored while the cooldown runs or the run is not active. */
  shoot(): void {
    if (this.state !== "running" || this.shotCooldown > 0) return;
    this.shotCooldown = SHOT_COOLDOWN;
    this.shotList = [...this.shotList, { x: this.distance + CONFIG.RUNNER_X + SHOT_OFFSET }];
    this.emit("shot");
  }

  /** Shots in flight, in world order, for drawing. */
  get shots(): readonly Shot[] {
    return this.shotList;
  }

  get runnerState(): RunnerState {
    return this.runner;
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
    if (step.landed) this.emit("land");

    this.speed = speedAt(this.elapsed);
    this.distance += this.speed * DT;
    for (let i = milestonesCrossed(previousDistance, this.distance); i > 0; i--) {
      this.emit("milestone");
    }

    this.advanceShots();
    this.extendObstacles();
    if (this.hasCollision()) {
      this.state = "ended";
      this.emit("crash");
    }
  }

  /** Moves shots forward, removes the first obstacle each one reaches, and drops shots out of range. */
  private advanceShots(): void {
    this.shotCooldown = Math.max(0, this.shotCooldown - DT);
    const moved = this.shotList.map((shot) => ({ x: shot.x + SHOT_SPEED * DT }));
    const runnerX = this.distance + CONFIG.RUNNER_X;
    const survivors: Shot[] = [];
    for (const shot of moved) {
      const target = findShotTarget(shot.x, this.obstacles);
      if (target) {
        this.obstacles = this.obstacles.filter((o) => o !== target);
        this.emit("hit");
        continue;
      }
      if (shot.x <= runnerX + SHOT_RANGE) survivors.push(shot);
    }
    this.shotList = survivors;
  }

  private hasCollision(): boolean {
    const runnerX = this.distance + CONFIG.RUNNER_X;
    return this.obstacles.some((o) => collides(this.runner, this.metrics, o, runnerX));
  }

  private extendObstacles(): void {
    const reach = this.distance + CONFIG.RUNNER_X + LOOKAHEAD;
    while (this.obstacles.length === 0 || this.lastObstacleX() < reach) {
      const startX = this.obstacles.length === 0 ? CONFIG.FIRST_OBSTACLE_X : this.lastObstacleX() + CONFIG.MAX_SPACING;
      this.obstacles.push(...generateObstacles(this.rng, this.metrics, OBSTACLE_BATCH, startX));
    }
  }

  private lastObstacleX(): number {
    return this.obstacles[this.obstacles.length - 1]?.x ?? 0;
  }

  private emit(type: RunEventType): void {
    this.onEvent({ type, distance: this.distance });
  }
}
