import { describe, expect, it } from "vitest";
import { getBest, recordBest, type KeyValueStore } from "../../src/game/best-score";

function memoryStore(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
  };
}

const throwingStore: KeyValueStore = {
  getItem: () => {
    throw new Error("blocked");
  },
  setItem: () => {
    throw new Error("blocked");
  },
};

describe("best score (FR-026)", () => {
  it("returns null when nothing is stored", () => {
    expect(getBest(memoryStore())).toBeNull();
  });

  it("returns null without crashing when storage throws (blocked storage)", () => {
    expect(getBest(throwingStore)).toBeNull();
  });

  it("stores a new best and reports it as new", () => {
    const store = memoryStore();
    const result = recordBest(store, 420, new Date("2026-11-18T12:00:00Z"));
    expect(result.isNewBest).toBe(true);
    expect(getBest(store)?.distance).toBe(420);
    expect(getBest(store)?.achievedAt).toBe("2026-11-18T12:00:00.000Z");
  });

  it("does not overwrite with a lower or equal distance", () => {
    const store = memoryStore();
    recordBest(store, 500, new Date());
    const result = recordBest(store, 500, new Date());
    expect(result.isNewBest).toBe(false);
    expect(getBest(store)?.distance).toBe(500);
  });

  it("does not throw when storage is blocked, and reports nothing new", () => {
    expect(recordBest(throwingStore, 100, new Date()).isNewBest).toBe(false);
  });
});
