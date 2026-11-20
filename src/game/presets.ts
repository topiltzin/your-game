// Preset characters: small pixel-art creatures built into the game, so a player can run as one
// without drawing or waiting for a 3D model. Each grid is 10 columns by 12 rows.
// "x" is ink, "w" is paper (eye whites and teeth), "k" is ink inside an eye, "." is empty.
import type { CharacterMetrics } from "./character-metrics";

export interface Preset {
  readonly id: string;
  readonly label: string;
  readonly rows: readonly string[];
}

export const PRESETS: readonly Preset[] = [
  {
    id: "byte",
    label: "Byte",
    rows: [
      "....xx....",
      "....xx....",
      "..xxxxxx..",
      ".xxxxxxxx.",
      ".xwwwwwwx.",
      ".xwwkkwwx.",
      ".xwwkkwwx.",
      ".xwwwwwwx.",
      ".xxwxwxxx.",
      "..xxxxxx..",
      "..xx..xx..",
      "..xx..xx..",
    ],
  },
  {
    id: "blob",
    label: "Blob",
    rows: [
      "...xxxx...",
      "..xxxxxx..",
      ".xxxxxxxx.",
      ".xwwwwwwx.",
      "xxwkkkkwxx",
      "xxwkkkkwxx",
      "xxwwwwwwxx",
      "xxxxxxxxxx",
      ".xxxxxxxx.",
      "..xxxxxx..",
      "..x.xx.x..",
      "..x....x..",
    ],
  },
  {
    id: "robo",
    label: "Robo",
    rows: [
      "....xx....",
      "....xx....",
      "..xxxxxx..",
      ".xxxxxxxx.",
      ".xwkxxkwx.",
      ".xxxxxxxx.",
      ".xwwwwwwx.",
      ".xxxxxxxx.",
      ".xxxxxxxx.",
      "..xxxxxx..",
      "..xx..xx..",
      "..xx..xx..",
    ],
  },
];

export const PRESET_HEIGHT_UNITS = 150;

export function presetById(id: string): Preset | null {
  return PRESETS.find((preset) => preset.id === id) ?? null;
}

/** Collision box for a preset: the same height as the 3D character, width from its grid. */
export function presetMetrics(preset: Preset): CharacterMetrics {
  const columns = preset.rows[0]?.length ?? 1;
  return {
    heightUnits: PRESET_HEIGHT_UNITS,
    widthUnits: (PRESET_HEIGHT_UNITS * columns) / preset.rows.length,
  };
}

/** Draws a preset to an offscreen canvas, one square per grid cell, for previews and the runner sprite. */
export function renderPreset(preset: Preset, cell: number, ink: string, paper: string): HTMLCanvasElement {
  const columns = preset.rows[0]?.length ?? 1;
  const canvas = document.createElement("canvas");
  canvas.width = columns * cell;
  canvas.height = preset.rows.length * cell;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  preset.rows.forEach((row, r) => {
    for (let c = 0; c < row.length; c++) {
      const ch = row[c];
      if (ch === "." || ch === undefined) continue;
      ctx.fillStyle = ch === "w" ? paper : ink;
      ctx.fillRect(c * cell, r * cell, cell, cell);
    }
  });
  return canvas;
}
