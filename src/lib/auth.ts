import { scrypt, randomBytes, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { SignJWT, jwtVerify } from "jose";

const scryptAsync = promisify(scrypt);

export const SESSION_COOKIE = "cockpit_session";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export type Role = "admin" | "manager" | "employee";
export type SessionUser = { id: string; email: string; name: string | null; role: Role };

function secretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("AUTH_SECRET is not set (min. 16 chars)");
  }
  return new TextEncoder().encode(secret);
}

// ---- Password hashing (scrypt, no native deps) ----
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, key] = stored.split(":");
  if (!salt || !key) return false;
  const derived = (await scryptAsync(password, salt, 64)) as Buffer;
  const keyBuf = Buffer.from(key, "hex");
  return keyBuf.length === derived.length && timingSafeEqual(keyBuf, derived);
}

// ---- JWT session ----
export async function createSessionToken(user: SessionUser): Promise<string> {
  return new SignJWT({ email: user.email, name: user.name, role: user.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secretKey());
}

export async function verifySessionToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    return {
      id: String(payload.sub),
      email: String(payload.email),
      name: (payload.name as string) ?? null,
      role: (payload.role as Role) ?? "employee",
    };
  } catch {
    return null;
  }
}

export const MAX_AGE_SECONDS = MAX_AGE;

export function canWrite(role: Role | undefined): boolean {
  return role === "admin" || role === "manager";
}
