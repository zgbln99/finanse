import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireWriter } from "@/lib/auth-server";

export const dynamic = "force-dynamic";

const PatchSchema = z.object({ color: z.string().optional() });

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireWriter(req);
  if ("response" in auth) return auth.response;
  const { id } = await params;
  const body = PatchSchema.parse(await req.json());
  const tag = await prisma.tag.update({ where: { id }, data: { color: body.color } });
  return NextResponse.json({ tag });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireWriter(req);
  if ("response" in auth) return auth.response;
  const { id } = await params;
  await prisma.tag.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
