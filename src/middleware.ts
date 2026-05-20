import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const SESSION_COOKIE = "cockpit_session";

// Paths reachable without a session.
const PUBLIC_PREFIXES = ["/login", "/api/auth", "/share", "/api/share"];

function isPublic(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/") || pathname.startsWith(p + "?"));
}

async function valid(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const secret = process.env.AUTH_SECRET;
  if (!secret) return false;
  try {
    await jwtVerify(token, new TextEncoder().encode(secret));
    return true;
  } catch {
    return false;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (isPublic(pathname)) return NextResponse.next();

  const ok = await valid(req.cookies.get(SESSION_COOKIE)?.value);
  if (ok) return NextResponse.next();

  // API → 401 JSON; pages → redirect to login with return path.
  if (pathname.startsWith("/api")) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  // Run on everything except Next internals and static assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt).*)"],
};
