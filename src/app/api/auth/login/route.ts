import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  verifyPassword,
  createSessionToken,
  SESSION_COOKIE,
  MAX_AGE_SECONDS,
  type Role,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

const Body = z.object({ email: z.string().email(), password: z.string().min(1) });

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Ungültige Eingabe" }, { status: 400 });

  const { email, password } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  // Constant-ish: still run verify against a dummy when user missing.
  const ok = user ? await verifyPassword(password, user.passwordHash) : false;
  if (!user || !ok) {
    return NextResponse.json({ error: "E-Mail oder Passwort falsch" }, { status: 401 });
  }

  const token = await createSessionToken({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role as Role,
  });

  const res = NextResponse.json({ ok: true, role: user.role });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
  return res;
}
