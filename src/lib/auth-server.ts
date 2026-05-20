import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken, canWrite, type SessionUser } from "./auth";

/** Current user from the session cookie (server components / route handlers). */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

/** For API routes: returns the user if they may write, else a 403/401 response. */
export async function requireWriter(
  req: NextRequest,
): Promise<{ user: SessionUser } | { response: NextResponse }> {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const user = token ? await verifySessionToken(token) : null;
  if (!user) return { response: NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 }) };
  if (!canWrite(user.role)) {
    return { response: NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 }) };
  }
  return { user };
}
