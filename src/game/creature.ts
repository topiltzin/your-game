// The runner: a pixel-art creature drawn on the canvas, in the same retro style as the game.
// Each pixel is PIXEL_UNITS world units, so the drawing and its collision box (CREATURE_METRICS)
// are exactly the same size.
import { CONFIG } from "./config";
import type { CharacterMetrics } from "./character-metrics";

export const PIXEL_UNITS = 10;

/** Body rows. "x" is ink, "w" is paper (eye whites and teeth), "k" is ink inside the eye, "." is empty. */
const BODY: readonly string[] = [
  "....xx....", // antenna ball
  "....xx....", // antenna stalk
  "..xxxxxx..", // head
  ".xxxxxxxx.",
  ".xwwwwwwx.", // eye band
  ".xwwkkwwx.", // pupil
  ".xwwkkwwx.",
  ".xwwwwwwx.",
  ".xxwxwxxx.", // grin with teeth
  "..xxxxxx..", // chin
];
const LEG_ROWS = 2;
const LEG_LEFT_COL = 2;
const LEG_RIGHT_COL = 6;

/** Collision box of the creature: 10 columns by 12 rows of pixels, feet on the ground. */
export const CREATURE_METRICS: CharacterMetrics = Object.freeze({
  widthUnits: BODY[0]!.length * PIXEL_UNITS,
  heightUnits: (BODY.length + LEG_ROWS) * PIXEL_UNITS,
});

/** Body height while sliding, so the drawing matches the slide hitbox (SLIDE_HEIGHT_FACTOR). */
const SLIDE_BODY_SCALE =
  (CONFIG.SLIDE_HEIGHT_FACTOR * CREATURE_METRICS.heightUnits - LEG_ROWS * PIXEL_UNITS) / (BODY.length * PIXEL_UNITS);

export interface CreaturePose {
  readonly frame: number; // alternates while running on the ground
  readonly airborne: boolean;
  readonly sliding: boolean;
  readonly ink: string;
  readonly paper: string;
}

/**
 * Draws the creature with its feet at (feetX, feetY). `unit` is pixels per world unit.
 * The caller scales the context for squash and stretch, so this works in local coordinates.
 */
export function drawCreature(ctx: CanvasRenderingContext2D, feetX: number, feetY: number, unit: number, pose: CreaturePose): void {
  const p = PIXEL_UNITS * unit;
  const left = feetX - (CREATURE_METRICS.widthUnits * unit) / 2;
  const bodyScale = pose.sliding ? SLIDE_BODY_SCALE : 1;
  const rowH = p * bodyScale;
  const bodyBottom = feetY - LEG_ROWS * p;
  const bodyTop = bodyBottom - BODY.length * rowH;

  BODY.forEach((row, r) => {
    for (let c = 0; c < row.length; c++) {
      const ch = row[c];
      if (ch === ".") continue;
      ctx.fillStyle = ch === "w" ? pose.paper : pose.ink;
      // Snap every pixel to whole screen pixels so neighbouring pixels meet without seams.
      const x0 = Math.round(left + c * p);
      const x1 = Math.round(left + (c + 1) * p);
      const y0 = Math.round(bodyTop + r * rowH);
      const y1 = Math.round(bodyTop + (r + 1) * rowH);
      ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    }
  });

  if (pose.sliding) return;
  ctx.fillStyle = pose.ink;
  const leftFootDown = pose.frame % 2 === 0;
  const legY = (down: boolean) => (pose.airborne || !down ? feetY - 2 * p : feetY - p);
  ctx.fillRect(left + LEG_LEFT_COL * p, legY(leftFootDown), 2 * p, p);
  ctx.fillRect(left + LEG_RIGHT_COL * p, legY(!leftFootDown), 2 * p, p);
}
