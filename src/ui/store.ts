// Device storage for the best score. Blocked storage degrades to a no-op store, never an error.
import type { KeyValueStore } from "../game/best-score";

const MEMORY = new Map<string, string>();

export function localStore(): KeyValueStore {
  return {
    getItem(key) {
      try {
        return window.localStorage.getItem(key);
      } catch {
        return MEMORY.get(key) ?? null;
      }
    },
    setItem(key, value) {
      try {
        window.localStorage.setItem(key, value);
      } catch {
        MEMORY.set(key, value);
      }
    },
  };
}
