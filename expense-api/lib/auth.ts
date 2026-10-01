import { createHash, createHmac, timingSafeEqual } from "crypto";

export const SESSION_COOKIE = "session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 90;

export function isAuthConfigured(): boolean {
  return Boolean(process.env.APP_PASSWORD);
}

// Derived from the password, so changing APP_PASSWORD signs out every device.
function signingKey(): string | null {
  const password = process.env.APP_PASSWORD;
  if (!password) return null;
  return createHash("sha256")
    .update(`session-key:${password}:${process.env.DATABASE_URL ?? ""}`)
    .digest("hex");
}

function sign(payload: string, key: string): string {
  return createHmac("sha256", key).update(payload).digest("base64url");
}

function safeEqual(a: Buffer, b: Buffer): boolean {
  return a.length === b.length && timingSafeEqual(a, b);
}

export function checkPassword(input: unknown): boolean {
  const password = process.env.APP_PASSWORD;
  if (!password || typeof input !== "string") return false;
  const digest = (s: string) => createHash("sha256").update(s).digest();
  return safeEqual(digest(input), digest(password));
}

export function createSessionToken(): string | null {
  const key = signingKey();
  if (!key) return null;
  const expiresAt = String(Date.now() + SESSION_MAX_AGE * 1000);
  return `${expiresAt}.${sign(expiresAt, key)}`;
}

export function verifySessionToken(token: string | undefined): boolean {
  const key = signingKey();
  if (!key || !token) return false;
  const [expiresAt, signature] = token.split(".");
  if (!expiresAt || !signature || !/^\d+$/.test(expiresAt) || Number(expiresAt) < Date.now()) return false;
  return safeEqual(Buffer.from(sign(expiresAt, key)), Buffer.from(signature));
}
