import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-server";
import { hashPassword } from "@/lib/auth";

export const dynamic = "force-dynamic";

const PatchSchema = z.object({
  role: z.enum(["admin", "manager", "employee"]).optional(),
  name: z.string().nullable().optional(),
  password: z.string().min(8).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if ("response" in auth) return auth.response;
  const { id } = await params;
  const body = PatchSchema.parse(await req.json());

  const data: Record<string, unknown> = {};
  if (body.role !== undefined) data.role = body.role;
  if (body.name !== undefined) data.name = body.name;
  if (body.password) data.passwordHash = await hashPassword(body.password);

  // Never allow removing the last admin.
  if (body.role && body.role !== "admin") {
    const target = await prisma.user.findUnique({ where: { id } });
    if (target?.role === "admin") {
      const admins = await prisma.user.count({ where: { role: "admin" } });
      if (admins <= 1) return NextResponse.json({ error: "Letzter Administrator kann nicht herabgestuft werden" }, { status: 400 });
    }
  }

  const user = await prisma.user.update({
    where: { id },
    data,
    select: { id: true, email: true, name: true, role: true, createdAt: true },
  });
  return NextResponse.json({ user });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if ("response" in auth) return auth.response;
  const { id } = await params;
  if (auth.user.id === id) return NextResponse.json({ error: "Eigenes Konto nicht löschbar" }, { status: 400 });

  const target = await prisma.user.findUnique({ where: { id } });
  if (target?.role === "admin") {
    const admins = await prisma.user.count({ where: { role: "admin" } });
    if (admins <= 1) return NextResponse.json({ error: "Letzter Administrator kann nicht gelöscht werden" }, { status: 400 });
  }
  await prisma.user.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
