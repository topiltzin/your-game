import { describe, expect, it } from "vitest";
import { PRESETS, presetById, presetMetrics, PRESET_HEIGHT_UNITS } from "../../src/game/presets";

describe("preset characters", () => {
  it("every preset is a 10 by 12 grid of known characters", () => {
    for (const preset of PRESETS) {
      expect(preset.rows).toHaveLength(12);
      for (const row of preset.rows) {
        expect(row).toHaveLength(10);
        expect(row).toMatch(/^[.xwk]+$/);
      }
    }
  });

  it("has unique ids and finds a preset by id", () => {
    const ids = PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(presetById("byte")?.label).toBe("Byte");
    expect(presetById("missing")).toBeNull();
  });

  it("keeps the same height as the 3D character and a width from its grid", () => {
    const metrics = presetMetrics(PRESETS[0]!);
    expect(metrics.heightUnits).toBe(PRESET_HEIGHT_UNITS);
    expect(metrics.widthUnits).toBeCloseTo(PRESET_HEIGHT_UNITS * (10 / 12));
  });
});
