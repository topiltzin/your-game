// Reduced-motion preference (FR-025). A blocked or missing matchMedia counts as "no preference".
const QUERY = "(prefers-reduced-motion: reduce)";

export function prefersReducedMotion(): boolean {
  try {
    return typeof matchMedia === "function" && matchMedia(QUERY).matches;
  } catch {
    return false;
  }
}
