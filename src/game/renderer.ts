// Canvas drawing for a run. World units are scaled to pixels; the runner stays at RUNNER_X.
// Drawing only: nothing here changes run state, so gameplay is identical with or without effects.
import { CONFIG } from "./config";
import type { CharacterMetrics } from "./character-metrics";
import type { RunSession } from "./run";
import type { ParticlePool } from "./effects/particles";
import { parallaxOffsets } from "./effects/parallax";

const INK = "#1b1b1f";
const PAPER = "#f6f3ec";
const ACCENT = "#e2432f";

/** Pixels per world unit is height / REFERENCE_HEIGHT, so the scene keeps its shape at any size. */
const REFERENCE_HEIGHT = 700;
const GROUND_LINE_WIDTH = 3;
const HATCH_SPACING = 26; // world units between ground hatch strokes
const HATCH_DEPTH = 22; // world units each hatch stroke reaches below the ground
const HATCH_ALPHA = 0.22;
const SPEED_LINE_OFFSETS = [0.3, 0.55, 0.8] as const;
const SPEED_LINE_THRESHOLD = 0.05;
const SHADOW_FADE_HEIGHT = 160; // world units of lift at which the shadow is at its smallest
const STRETCH_HEIGHT = 120; // world units of lift at which the jump stretch is at full strength
const LANDING_DECAY = 0.82; // squash fraction kept per frame after a landing
const AIRBORNE_EPSILON = 0.5;

export interface RenderOptions {
  readonly sprite: CanvasImageSource | null;
  readonly metrics: CharacterMetrics;
  readonly reducedMotion: boolean;
}

interface BodyScale {
  readonly scaleX: number;
  readonly scaleY: number;
}

export class GameRenderer {
  private wasAirborne = false;
  /** 1 right after a landing, decaying toward 0. Drives the squash. */
  private landing = 0;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly options: RenderOptions,
  ) {}

  draw(run: RunSession, particles: ParticlePool): void {
    const ctx = this.canvas.getContext("2d");
    if (!ctx) return;
    const { width, height } = this.canvas;
    const unit = height / REFERENCE_HEIGHT;
    const groundY = height - height * 0.18;

    this.trackLanding(run.runnerState.y);

    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, width, height);
    this.drawParallax(ctx, run.distance, width, height, groundY);
    this.drawGround(ctx, run.distance, width, height, groundY, unit);

    for (const obstacle of run.upcoming()) this.drawObstacle(ctx, obstacle, run.distance, unit, groundY);
    this.drawShadow(ctx, run, unit, groundY);
    this.drawSpeedLines(ctx, run, unit, groundY);
    this.drawCharacter(ctx, run, unit, groundY);
    this.drawParticles(ctx, particles, unit, groundY, run.distance);
  }

  private trackLanding(lift: number): void {
    const airborne = lift > AIRBORNE_EPSILON;
    if (this.wasAirborne && !airborne) this.landing = 1;
    this.wasAirborne = airborne;
    this.landing *= LANDING_DECAY;
  }

  private drawParallax(ctx: CanvasRenderingContext2D, distance: number, width: number, height: number, groundY: number): void {
    if (this.options.reducedMotion) return;
    const [far = 0, near = 0] = parallaxOffsets(distance, width, [0.15, 0.4]);
    ctx.fillStyle = "rgba(27,27,31,0.07)";
    for (let i = -1; i < 3; i++) {
      this.dome(ctx, i * width * 0.5 - far + width * 0.11, groundY, width * 0.11, height * 0.25);
      this.dome(ctx, i * width * 0.5 - near + width * 0.31, groundY, width * 0.06, height * 0.1);
    }
  }

  /** A half-ellipse hill standing on the ground line. */
  private dome(ctx: CanvasRenderingContext2D, cx: number, baseY: number, rx: number, ry: number): void {
    ctx.beginPath();
    ctx.ellipse(cx, baseY, rx, ry, 0, Math.PI, 0);
    ctx.fill();
  }

  /** Ground line plus sketch hatching below it. The hatching scrolls with the run, which sells speed. */
  private drawGround(ctx: CanvasRenderingContext2D, distance: number, width: number, height: number, groundY: number, unit: number): void {
    ctx.strokeStyle = INK;
    ctx.lineWidth = GROUND_LINE_WIDTH;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(width, groundY);
    ctx.stroke();

    const spacing = HATCH_SPACING * unit;
    const shift = this.options.reducedMotion ? 0 : (distance * unit) % spacing;
    const depth = HATCH_DEPTH * unit;
    const top = groundY + 6 * unit;

    ctx.save();
    ctx.globalAlpha = HATCH_ALPHA;
    ctx.lineWidth = Math.max(1, 1.5 * unit);
    ctx.beginPath();
    for (let x = -spacing - shift; x < width + spacing; x += spacing) {
      ctx.moveTo(x, top);
      ctx.lineTo(x - depth * 0.6, Math.min(height, top + depth));
    }
    ctx.stroke();
    ctx.restore();
  }

  private drawObstacle(ctx: CanvasRenderingContext2D, o: ReturnType<RunSession["upcoming"]>[number], distance: number, unit: number, groundY: number): void {
    const x = (o.x - distance) * unit + CONFIG.RUNNER_X * unit;
    const w = o.width * unit;
    if (o.kind === "ground_gap") {
      // Paint over the ground line and hatching so the gap reads as a hole.
      ctx.fillStyle = PAPER;
      ctx.fillRect(x, groundY - GROUND_LINE_WIDTH / 2, w, groundY);
      return;
    }
    if (o.kind === "overhead") {
      const top = groundY - o.clearance * unit;
      const barHeight = 14;
      ctx.fillStyle = ACCENT;
      roundedRect(ctx, x, top - barHeight, w, barHeight, Math.min(barHeight / 2, w / 2));
      ctx.fill();
      return;
    }
    const gap = o.gapWidth * unit;
    const wallW = (w - gap) / 2;
    const wallH = 120 * unit;
    const radius = Math.min(8 * unit, wallW / 2);
    ctx.fillStyle = INK;
    // Extend each pillar past the ground line by its radius so the bottom corners sit under the ground.
    roundedRect(ctx, x, groundY - wallH, wallW, wallH + radius, radius);
    ctx.fill();
    roundedRect(ctx, x + wallW + gap, groundY - wallH, wallW, wallH + radius, radius);
    ctx.fill();
  }

  /** Soft contact shadow. It shrinks as the runner rises, so height reads without extra art. */
  private drawShadow(ctx: CanvasRenderingContext2D, run: RunSession, unit: number, groundY: number): void {
    const { widthUnits } = this.options.metrics;
    const lift = Math.min(1, run.runnerState.y / SHADOW_FADE_HEIGHT);
    const rx = widthUnits * unit * 0.42 * (1 - lift * 0.5);
    const ry = Math.max(3 * unit, rx * 0.18);
    ctx.save();
    ctx.fillStyle = "rgba(27,27,31,0.18)";
    ctx.beginPath();
    ctx.ellipse(CONFIG.RUNNER_X * unit, groundY + 1.5 * unit, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /** Trailing streaks that grow with run speed. Skipped under reduced motion. */
  private drawSpeedLines(ctx: CanvasRenderingContext2D, run: RunSession, unit: number, groundY: number): void {
    if (this.options.reducedMotion) return;
    const range = CONFIG.MAX_SPEED - CONFIG.START_SPEED;
    const intensity = Math.max(0, Math.min(1, (run.speed - CONFIG.START_SPEED) / range));
    if (intensity < SPEED_LINE_THRESHOLD) return;

    const { heightUnits, widthUnits } = this.options.metrics;
    const back = CONFIG.RUNNER_X * unit - (widthUnits * unit) / 2 - 14 * unit;
    const length = (24 + 90 * intensity) * unit;
    ctx.save();
    ctx.strokeStyle = INK;
    ctx.lineCap = "round";
    ctx.lineWidth = Math.max(2, 3 * unit);
    ctx.globalAlpha = 0.35 * intensity;
    ctx.beginPath();
    for (const fraction of SPEED_LINE_OFFSETS) {
      const y = groundY - heightUnits * unit * fraction;
      ctx.moveTo(back, y);
      ctx.lineTo(back - length, y);
    }
    ctx.stroke();
    ctx.restore();
  }

  private drawCharacter(ctx: CanvasRenderingContext2D, run: RunSession, unit: number, groundY: number): void {
    const { heightUnits, widthUnits } = this.options.metrics;
    const state = run.runnerState;
    const height = (state.mode === "sliding" ? heightUnits * CONFIG.SLIDE_HEIGHT_FACTOR : heightUnits) * unit;
    const width = widthUnits * unit;
    const feetX = CONFIG.RUNNER_X * unit;
    const feetY = groundY - state.y * unit;
    const { scaleX, scaleY } = this.bodyScale(state.y);

    ctx.save();
    // Scale around the feet so the squash plants the runner on the ground.
    ctx.translate(feetX, feetY);
    ctx.scale(scaleX, scaleY);
    if (this.options.sprite) {
      ctx.drawImage(this.options.sprite, -width / 2, -height, width, height);
    } else {
      ctx.fillStyle = INK;
      ctx.fillRect(-width / 2, -height, width, height);
    }
    ctx.restore();
  }

  private bodyScale(lift: number): BodyScale {
    if (this.options.reducedMotion) return { scaleX: 1, scaleY: 1 };
    const stretch = Math.min(1, Math.max(0, lift) / STRETCH_HEIGHT);
    const squash = this.landing;
    return {
      scaleX: 1 + 0.12 * squash - 0.03 * stretch,
      scaleY: 1 - 0.14 * squash + 0.05 * stretch,
    };
  }

  private drawParticles(ctx: CanvasRenderingContext2D, particles: ParticlePool, unit: number, groundY: number, distance: number): void {
    for (const p of particles.list()) {
      const x = (p.x - distance) * unit + CONFIG.RUNNER_X * unit;
      const y = groundY - p.y * unit;
      const fade = Math.max(0, Math.min(1, p.life * 2));
      ctx.globalAlpha = fade;
      ctx.fillStyle = p.color === "accent" ? ACCENT : INK;
      ctx.beginPath();
      ctx.arc(x, y, (2 + 3 * fade) * unit, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

/** Rounded rectangle path. The caller fills it. */
function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}
