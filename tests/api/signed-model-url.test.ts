import { describe, expect, it } from "vitest";
import { signModelUrl, verifyModelUrl } from "../../server/lib/signed-model-url";

const SECRET = "test-secret-at-least-32-bytes-long!!";
const NOW = new Date("2026-11-18T12:00:00.000Z");

describe("signed model URLs (FR-004, contract: 15-minute TTL)", () => {
  it("verifies a URL it signed within its TTL", () => {
    const url = signModelUrl({ key: "models/job-1.glb", ttlSeconds: 900, secret: SECRET, baseUrl: "https://app.test", now: NOW });
    expect(verifyModelUrl(new URL(url), { secret: SECRET, now: NOW })).toBe("models/job-1.glb");
  });

  it("puts the model in a single path segment, because the deployed router 404s on deeper paths", () => {
    const url = new URL(signModelUrl({ key: "models/job-1.glb", ttlSeconds: 900, secret: SECRET, baseUrl: "https://app.test", now: NOW }));
    expect(url.pathname).toBe("/api/models/job-1.glb");
  });

  it("rejects a URL that presents a different segment name", () => {
    const url = new URL(signModelUrl({ key: "models/job-1.glb", ttlSeconds: 900, secret: SECRET, baseUrl: "https://app.test", now: NOW }));
    url.pathname = "/api/models/job-2.glb";
    expect(verifyModelUrl(url, { secret: SECRET, now: NOW })).toBeNull();
  });

  it("rejects an expired URL", () => {
    const url = signModelUrl({ key: "models/job-1.glb", ttlSeconds: 900, secret: SECRET, baseUrl: "https://app.test", now: NOW });
    const later = new Date(NOW.getTime() + 901 * 1000);
    expect(verifyModelUrl(new URL(url), { secret: SECRET, now: later })).toBeNull();
  });

  it("rejects a URL whose key was changed after signing", () => {
    const url = new URL(signModelUrl({ key: "models/job-1.glb", ttlSeconds: 900, secret: SECRET, baseUrl: "https://app.test", now: NOW }));
    url.pathname = "/api/models/models/other.glb";
    expect(verifyModelUrl(url, { secret: SECRET, now: NOW })).toBeNull();
  });

  it("rejects a URL signed with a different secret", () => {
    const url = new URL(signModelUrl({ key: "models/job-1.glb", ttlSeconds: 900, secret: "another-secret-another-secret-xx", baseUrl: "https://app.test", now: NOW }));
    expect(verifyModelUrl(url, { secret: SECRET, now: NOW })).toBeNull();
  });
});
