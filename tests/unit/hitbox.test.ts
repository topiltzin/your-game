import { describe, expect, it } from "vitest";
import { CONFIG } from "../../src/game/config";
import { createRunner, requestJump, requestSlide } from "../../src/game/physics";
import { hitboxFor } from "../../src/game/hitbox";
import { STANDARD } from "../fixtures/characters";

describe("hitbox", () => {
  it("standing uses the full height and width on the ground", () => {
    const box = hitboxFor(createRunner(), STANDARD);
    expect(box).toEqual({ bottom: 0, top: STANDARD.heightUnits, width: STANDARD.widthUnits });
  });

  it("sliding uses SLIDE_HEIGHT_FACTOR of the height and the same width", () => {
    const box = hitboxFor(requestSlide(createRunner()), STANDARD);
    expect(box.top - box.bottom).toBeCloseTo(STANDARD.heightUnits * CONFIG.SLIDE_HEIGHT_FACTOR);
    expect(box.width).toBe(STANDARD.widthUnits);
  });

  it("jumping uses the standing box at the current height", () => {
    const jumping = requestJump(createRunner());
    const box = hitboxFor({ ...jumping, y: 100 }, STANDARD);
    expect(box.bottom).toBe(100);
    expect(box.top).toBe(100 + STANDARD.heightUnits);
    expect(box.width).toBe(STANDARD.widthUnits);
  });
});
