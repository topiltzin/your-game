import { defineConfig, devices } from "@playwright/test";

// End-to-end flows (tests/e2e). They need `vercel dev` or a deployed preview with the
// Marketplace integrations provisioned; see specs/001-sketch-runner-3d/quickstart.md.
export default defineConfig({
  testDir: "tests/e2e",
  use: { baseURL: process.env["BASE_URL"] ?? "http://localhost:3000", trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "phone", use: { ...devices["iPhone 13"] } },
    { name: "reduced-motion", use: { ...devices["Desktop Chrome"], reducedMotion: "reduce" } },
  ],
});
