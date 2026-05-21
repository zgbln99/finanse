import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-server";
import { hashPassword } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("response" in auth) return auth.response;
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, email: true, name: true, role: true, createdAt: true },
  });
  return NextResponse.json({ users });
}

const CreateSchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
  role: z.enum(["admin", "manager", "employee"]),
  password: z.string().min(8),
});

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("response" in auth) return auth.response;
  const parsed = CreateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Ungültige Eingabe (Passwort min. 8 Zeichen)" }, { status: 400 });

  const { email, name, role, password } = parsed.data;
  const exists = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (exists) return NextResponse.json({ error: "E-Mail bereits vergeben" }, { status: 409 });

  const user = await prisma.user.create({
    data: { email: email.toLowerCase(), name, role, passwordHash: await hashPassword(password) },
    select: { id: true, email: true, name: true, role: true, createdAt: true },
  });
  return NextResponse.json({ user });
}
