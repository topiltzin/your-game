import { describe, expect, it } from "vitest";
import { toCharacterMetrics } from "../../src/character/size-cap";

describe("character size cap (FR-021)", () => {
  it("a square drawing maps to the base height without capping", () => {
    const { metrics, sizeCapped } = toCharacterMetrics({ width: 100, height: 100 });
    expect(metrics.heightUnits).toBe(150);
    expect(metrics.widthUnits).toBe(150);
    expect(sizeCapped).toBe(false);
  });

  it("a very wide drawing is capped to the width maximum and reports sizeCapped", () => {
    const { metrics, sizeCapped } = toCharacterMetrics({ width: 300, height: 100 });
    expect(metrics.widthUnits).toBeLessThanOrEqual(200);
    expect(sizeCapped).toBe(true);
  });

  it("keeps the aspect ratio when capping", () => {
    const { metrics } = toCharacterMetrics({ width: 300, height: 100 });
    expect(metrics.widthUnits / metrics.heightUnits).toBeCloseTo(3, 5);
  });
});
