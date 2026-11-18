// Canvas drawing for a run. World units are scaled to pixels; the runner stays at RUNNER_X.
import { CONFIG } from "./config";
import type { CharacterMetrics } from "./character-metrics";
import type { RunSession } from "./run";
import type { ParticlePool } from "./effects/particles";
import { parallaxOffsets } from "./effects/parallax";

const INK = "#1b1b1f";
const PAPER = "#f6f3ec";
const ACCENT = "#e2432f";

export interface RenderOptions {
  readonly sprite: CanvasImageSource | null;
  readonly metrics: CharacterMetrics;
  readonly reducedMotion: boolean;
}

export class GameRenderer {
  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly options: RenderOptions,
  ) {}

  draw(run: RunSession, particles: ParticlePool): void {
    const ctx = this.canvas.getContext("2d");
    if (!ctx) return;
    const { width, height } = this.canvas;
    const unit = height / 700; // pixels per world unit
    const groundY = height - height * 0.18;

    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, width, height);
    this.drawParallax(ctx, run.distance, width, height, groundY);

    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(width, groundY);
    ctx.stroke();

    for (const obstacle of run.upcoming()) this.drawObstacle(ctx, obstacle, run.distance, unit, groundY);
    this.drawCharacter(ctx, run, unit, groundY);
    this.drawParticles(ctx, particles, unit, groundY, run.distance);
  }

  private drawParallax(ctx: CanvasRenderingContext2D, distance: number, width: number, height: number, groundY: number): void {
    if (this.options.reducedMotion) return;
    const [far = 0, near = 0] = parallaxOffsets(distance, width, [0.15, 0.4]);
    ctx.fillStyle = "rgba(27,27,31,0.07)";
    for (let i = -1; i < 3; i++) {
      ctx.fillRect(i * width * 0.5 - far, groundY - height * 0.25, width * 0.22, height * 0.25);
      ctx.fillRect(i * width * 0.5 - near + width * 0.25, groundY - height * 0.1, width * 0.12, height * 0.1);
    }
  }

  private drawObstacle(ctx: CanvasRenderingContext2D, o: ReturnType<RunSession["upcoming"]>[number], distance: number, unit: number, groundY: number): void {
    const x = (o.x - distance) * unit + CONFIG.RUNNER_X * unit;
    const w = o.width * unit;
    ctx.fillStyle = INK;
    ctx.strokeStyle = INK;
    if (o.kind === "ground_gap") {
      ctx.fillStyle = PAPER;
      ctx.fillRect(x, groundY, w, groundY);
      ctx.strokeRect(x, groundY, w, 0);
    } else if (o.kind === "overhead") {
      const top = groundY - o.clearance * unit;
      ctx.fillStyle = ACCENT;
      ctx.fillRect(x, top - 14, w, 14);
    } else {
      const gap = o.gapWidth * unit;
      const wallW = (w - gap) / 2;
      ctx.fillStyle = INK;
      ctx.fillRect(x, groundY - 120 * unit, wallW, 120 * unit);
      ctx.fillRect(x + wallW + gap, groundY - 120 * unit, wallW, 120 * unit);
    }
  }

  private drawCharacter(ctx: CanvasRenderingContext2D, run: RunSession, unit: number, groundY: number): void {
    const { heightUnits, widthUnits } = this.options.metrics;
    const state = run.runnerState;
    const height = (state.mode === "sliding" ? heightUnits * CONFIG.SLIDE_HEIGHT_FACTOR : heightUnits) * unit;
    const width = widthUnits * unit;
    const x = CONFIG.RUNNER_X * unit - width / 2;
    const y = groundY - state.y * unit - height;
    if (this.options.sprite) {
      ctx.drawImage(this.options.sprite, x, y, width, height);
    } else {
      ctx.fillStyle = INK;
      ctx.fillRect(x, y, width, height);
    }
  }

  private drawParticles(ctx: CanvasRenderingContext2D, particles: ParticlePool, unit: number, groundY: number, distance: number): void {
    ctx.fillStyle = INK;
    for (const p of particles.list()) {
      const x = (p.x - distance) * unit + CONFIG.RUNNER_X * unit;
      const y = groundY - p.y * unit;
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 2));
      ctx.beginPath();
      ctx.arc(x, y, 4 * unit + 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}
