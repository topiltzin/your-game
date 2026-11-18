import { defineConfig } from "vitest/config";

// Two projects: DOM-free unit tests for game logic and client helpers, and node-based API tests.
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "unit",
          include: ["tests/unit/**/*.test.ts"],
          environment: "jsdom",
        },
      },
      {
        test: {
          name: "api",
          include: ["tests/api/**/*.test.ts"],
          environment: "node",
        },
      },
    ],
    coverage: {
      provider: "v8",
      include: ["src/game/**", "api/**", "workflows/**"],
      thresholds: { lines: 80, branches: 80, functions: 80, statements: 80 },
    },
  },
});
