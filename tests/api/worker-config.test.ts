import { describe, expect, it } from "vitest";
import { DEFAULT_SF3D_URL, loadWorkerConfig } from "../../worker/config";

const REQUIRED = { SUPABASE_URL: "https://project.example", SUPABASE_SECRET_KEY: "secret-value" };

describe("loadWorkerConfig", () => {
  it("reads the required variables and applies the defaults", () => {
    const config = loadWorkerConfig({ ...REQUIRED });
    expect(config.supabaseUrl).toBe("https://project.example");
    expect(config.secretKey).toBe("secret-value");
    expect(config.sf3dUrl).toBe(DEFAULT_SF3D_URL);
    expect(config.pollMs).toBe(5000);
    expect(config.workerId.length).toBeGreaterThan(0);
  });

  it("uses SF3D_API_URL, WORKER_ID and POLL_SECONDS when set", () => {
    const config = loadWorkerConfig({
      ...REQUIRED,
      SF3D_API_URL: "https://other.example/generate",
      WORKER_ID: "vm-1",
      POLL_SECONDS: "2",
    });
    expect(config.sf3dUrl).toBe("https://other.example/generate");
    expect(config.workerId).toBe("vm-1");
    expect(config.pollMs).toBe(2000);
  });

  it("names the missing required variable without printing any value", () => {
    expect(() => loadWorkerConfig({ SUPABASE_SECRET_KEY: "secret-value" })).toThrow("SUPABASE_URL is not set");
    expect(() => loadWorkerConfig({ SUPABASE_URL: "https://project.example" })).toThrow("SUPABASE_SECRET_KEY is not set");
  });

  it("rejects a POLL_SECONDS that is not a positive number", () => {
    expect(() => loadWorkerConfig({ ...REQUIRED, POLL_SECONDS: "0" })).toThrow("POLL_SECONDS must be a positive number");
    expect(() => loadWorkerConfig({ ...REQUIRED, POLL_SECONDS: "soon" })).toThrow("POLL_SECONDS must be a positive number");
  });
});
