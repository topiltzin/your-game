import { createHmac, timingSafeEqual } from "node:crypto";

// Model files are private. The player gets a short-lived URL to this app's /api/models route,
// which checks the signature and expiry, then streams the file from private Blob.

const ROUTE_PREFIX = "/api/models/";

export interface SignOptions {
  readonly key: string;
  readonly ttlSeconds: number;
  readonly secret: string;
  readonly baseUrl: string;
  readonly now: Date;
}

export function signModelUrl(options: SignOptions): string {
  const expires = Math.floor(options.now.getTime() / 1000) + options.ttlSeconds;
  const sig = sign(options.secret, options.key, expires);
  const url = new URL(`${ROUTE_PREFIX}${options.key}`, options.baseUrl);
  url.searchParams.set("exp", String(expires));
  url.searchParams.set("sig", sig);
  return url.toString();
}

/** Returns the blob key when the URL is genuine and unexpired, otherwise null. */
export function verifyModelUrl(url: URL, options: { secret: string; now: Date }): string | null {
  if (!url.pathname.startsWith(ROUTE_PREFIX)) return null;
  const key = url.pathname.slice(ROUTE_PREFIX.length);
  const expires = Number(url.searchParams.get("exp"));
  const presented = url.searchParams.get("sig") ?? "";
  if (!key || !Number.isFinite(expires)) return null;
  if (Math.floor(options.now.getTime() / 1000) > expires) return null;

  const expected = Buffer.from(sign(options.secret, key, expires), "utf8");
  const given = Buffer.from(presented, "utf8");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  return key;
}

function sign(secret: string, key: string, expires: number): string {
  return createHmac("sha256", secret).update(`${key}|${expires}`).digest("hex");
}
