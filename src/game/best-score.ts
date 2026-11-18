// Best distance on this device (FR-026). Every storage access is guarded: blocked or full
// storage must never stop the game.

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface BestScore {
  readonly distance: number;
  readonly achievedAt: string;
}

export const BEST_KEY = "sketchRunner.best";

export function getBest(store: KeyValueStore): BestScore | null {
  try {
    const raw = store.getItem(BEST_KEY);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    return isBestScore(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function recordBest(store: KeyValueStore, distance: number, now: Date): { isNewBest: boolean } {
  const current = getBest(store);
  const floored = Math.floor(distance);
  if (current !== null && floored <= current.distance) return { isNewBest: false };
  try {
    const next: BestScore = { distance: floored, achievedAt: now.toISOString() };
    store.setItem(BEST_KEY, JSON.stringify(next));
    return { isNewBest: true };
  } catch {
    return { isNewBest: false };
  }
}

function isBestScore(value: unknown): value is BestScore {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v["distance"] === "number" && typeof v["achievedAt"] === "string";
}
