// 2D/3D presentation choice (FR-008 to FR-010). Pure: the screen supplies the facts.

/** 2D is the player's own sketch, 3D is the optional rendered model, preset is a built-in character. */
export type Presentation = "2d" | "3d" | "preset";
export type ModelStatus = "none" | "queued" | "processing" | "ready" | "failed" | "timed_out" | "cancelled";

export interface PresentationFacts {
  readonly modelStatus: ModelStatus;
  readonly webgl: boolean;
}

export type Availability = { readonly available: true } | { readonly available: false; readonly reason: string };

const FALLBACK = "You can still play in 2D.";

export function presentationAvailability(facts: PresentationFacts, presentation: Presentation): Availability {
  if (presentation === "2d" || presentation === "preset") return { available: true };
  if (!facts.webgl) {
    return { available: false, reason: `This browser can't show 3D. ${FALLBACK}` };
  }
  if (facts.modelStatus !== "ready") {
    return { available: false, reason: `The 3D model isn't ready. ${FALLBACK}` };
  }
  return { available: true };
}

export function spriteSourceFor(presentation: Presentation): "sketch" | "model" | "preset" {
  if (presentation === "3d") return "model";
  if (presentation === "preset") return "preset";
  return "sketch";
}
