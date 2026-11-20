import { describe, expect, it } from "vitest";
import { intentForKey, classifySwipe } from "../../src/game/input";

describe("input intents", () => {
  it("maps Space and ArrowUp to jump, ArrowDown to slide", () => {
    expect(intentForKey(" ")).toBe("jump");
    expect(intentForKey("Spacebar")).toBe("jump");
    expect(intentForKey("x")).toBe("shoot");
    expect(intentForKey("F")).toBe("shoot");
    expect(intentForKey("ArrowUp")).toBe("jump");
    expect(intentForKey("ArrowDown")).toBe("slide");
  });

  it("returns null for unrelated keys", () => {
    expect(intentForKey("a")).toBeNull();
  });

  it("classifies a downward swipe as slide when vertical movement dominates", () => {
    expect(classifySwipe({ dx: 4, dy: 80, durationMs: 200 })).toBe("slide");
  });

  it("treats a short tap-like movement as jump, not slide", () => {
    expect(classifySwipe({ dx: 2, dy: 3, durationMs: 120 })).toBe("jump");
  });

  it("ignores a horizontal swipe", () => {
    expect(classifySwipe({ dx: 120, dy: 10, durationMs: 200 })).toBe("jump");
  });
});
