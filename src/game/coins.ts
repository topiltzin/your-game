// Coins: the reward for jumping. They float in arcs above gaps and pillars, so a clean jump
// collects them. Pure logic: the run owns the list, the scene only draws it.
import type { Obstacle } from "./obstacles";

export interface Coin {
  readonly x: number;
  readonly y: number;
}

/** Horizontal reach of a coin for the runner's body, in game units. */
export const COIN_REACH_X = 50;
/** Vertical reach of a coin from the runner's body centre, in game units. */
export const COIN_REACH_Y = 90;
/** Height of a coin arc above the ground, in game units. Above every gap and pillar, so a jump is needed. */
export const COIN_ARC_HEIGHT = 170;
const COIN_SPACING = 42;
/** Chance an obstacle gets a coin arc. Not every obstacle, so the arcs stay a reward, not a path. */
export const COIN_CHANCE = 0.7;

/** Coins for one obstacle: a three-coin arc centred on it, or none if the obstacle is overhead (slide, don't jump). */
export function coinsFor(obstacle: Obstacle, roll: number): Coin[] {
  if (obstacle.kind === "overhead" || roll >= COIN_CHANCE) return [];
  const centre = obstacle.x + obstacle.width / 2;
  return [-1, 0, 1].map((step) => ({ x: centre + step * COIN_SPACING, y: COIN_ARC_HEIGHT }));
}

/** Splits coins into those the runner touches now and those still ahead. */
export function collectCoins(
  coins: readonly Coin[],
  runnerX: number,
  bodyCentreY: number,
): { readonly remaining: Coin[]; readonly collected: number } {
  const remaining: Coin[] = [];
  let collected = 0;
  for (const coin of coins) {
    const touching = Math.abs(coin.x - runnerX) <= COIN_REACH_X && Math.abs(coin.y - bodyCentreY) <= COIN_REACH_Y;
    if (touching) collected += 1;
    else remaining.push(coin);
  }
  return { remaining, collected };
}
