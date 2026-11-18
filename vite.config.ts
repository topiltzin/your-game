import { defineConfig } from "vite";

// The 3D viewer is kept out of the entry chunk: it is imported lazily on the first 3D view
// (see src/character/model-viewer.ts), so the game loads without it.
export default defineConfig({
  build: {
    target: "es2022",
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("@google/model-viewer") || id.includes("three")) return "model-viewer";
          if (id.includes("heic-to")) return "heic";
          return undefined;
        },
      },
    },
  },
});
