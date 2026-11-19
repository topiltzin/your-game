// Lazy loader for <model-viewer> (same library as emi_crafting). It is imported only when a 3D view
// is first shown, so the game itself never waits for it.
let loading: Promise<void> | null = null;

export function loadModelViewer(): Promise<void> {
  if (!loading) {
    loading = import("@google/model-viewer").then(
      () => undefined,
      (error: unknown) => {
        loading = null; // allow a retry after a transient chunk failure
        throw error;
      },
    );
  }
  return loading;
}

/** True when this browser can create a WebGL context (needed for the 3D view). */
export function webglAvailable(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

/** Builds a <model-viewer> element for a model URL. Camera controls let the player rotate and zoom. */
export function createViewer(src: string, label: string): HTMLElement {
  const viewer = document.createElement("model-viewer");
  viewer.setAttribute("src", src);
  viewer.setAttribute("camera-controls", "");
  viewer.setAttribute("auto-rotate", "");
  viewer.setAttribute("shadow-intensity", "0.6");
  // Built-in studio lighting, so the model is never rendered in an unlit (black) scene.
  viewer.setAttribute("environment-image", "neutral");
  viewer.setAttribute("exposure", "1");
  viewer.setAttribute("alt", label);
  viewer.className = "viewer";
  return viewer;
}
