import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireWriter } from "@/lib/auth-server";

export const dynamic = "force-dynamic";

const CreateSchema = z.object({
  contains: z.string().min(2),
  field: z.enum(["vendor", "text"]).default("vendor"),
  tagId: z.string(),
});

export async function POST(req: NextRequest) {
  const auth = await requireWriter(req);
  if ("response" in auth) return auth.response;
  const parsed = CreateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Ungültige Regel" }, { status: 400 });
  const rule = await prisma.tagRule.create({
    data: {
      contains: parsed.data.contains.toLowerCase().trim(),
      field: parsed.data.field,
      tagId: parsed.data.tagId,
    },
  });
  return NextResponse.json({ rule });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireWriter(req);
  if ("response" in auth) return auth.response;
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id fehlt" }, { status: 400 });
  await prisma.tagRule.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
