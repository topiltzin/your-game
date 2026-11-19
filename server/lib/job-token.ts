import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

const TOKEN_BYTES = 32; // 256-bit

/** Random capability token returned once to the creator. Only its hash is stored. */
export function generateJobToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** Constant-time check of a presented token against the stored hash. */
export function verifyToken(token: string, storedHash: string): boolean {
  const presented = Buffer.from(hashToken(token), "utf8");
  const expected = Buffer.from(storedHash, "utf8");
  return presented.length === expected.length && timingSafeEqual(presented, expected);
}
