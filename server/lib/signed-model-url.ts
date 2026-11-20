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

/** Storage keys are `models/<file>`. The URL carries only `<file>`: the deployed router 404s on deeper paths. */
const STORAGE_PREFIX = "models/";

export function signModelUrl(options: SignOptions): string {
  if (!options.key.startsWith(STORAGE_PREFIX)) throw new Error("model key must start with models/");
  const file = options.key.slice(STORAGE_PREFIX.length);
  const expires = Math.floor(options.now.getTime() / 1000) + options.ttlSeconds;
  const sig = sign(options.secret, file, expires);
  const url = new URL(`${ROUTE_PREFIX}${file}`, options.baseUrl);
  url.searchParams.set("exp", String(expires));
  url.searchParams.set("sig", sig);
  return url.toString();
}

/** Returns the storage key when the URL is genuine and unexpired, otherwise null. */
export function verifyModelUrl(url: URL, options: { secret: string; now: Date }): string | null {
  if (!url.pathname.startsWith(ROUTE_PREFIX)) return null;
  const file = url.pathname.slice(ROUTE_PREFIX.length);
  const expires = Number(url.searchParams.get("exp"));
  const presented = url.searchParams.get("sig") ?? "";
  if (!file || file.includes("/") || !Number.isFinite(expires)) return null;
  if (Math.floor(options.now.getTime() / 1000) > expires) return null;

  const expected = Buffer.from(sign(options.secret, file, expires), "utf8");
  const given = Buffer.from(presented, "utf8");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  return `${STORAGE_PREFIX}${file}`;
}

function sign(secret: string, key: string, expires: number): string {
  return createHmac("sha256", secret).update(`${key}|${expires}`).digest("hex");
}
