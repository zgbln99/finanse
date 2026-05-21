import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireWriter } from "@/lib/auth-server";
import { normalizeTag, tagColorFor } from "@/lib/tags";

export const dynamic = "force-dynamic";

export async function GET() {
  const [tags, rules] = await Promise.all([
    prisma.tag.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { documents: true } } },
    }),
    prisma.tagRule.findMany({ orderBy: { createdAt: "asc" } }),
  ]);
  return NextResponse.json({
    tags: tags.map((t) => ({ id: t.id, name: t.name, color: t.color, count: t._count.documents })),
    rules,
  });
}

const CreateSchema = z.object({ name: z.string().min(2), color: z.string().optional() });

export async function POST(req: NextRequest) {
  const auth = await requireWriter(req);
  if ("response" in auth) return auth.response;
  const parsed = CreateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Ungültiger Tag-Name" }, { status: 400 });
  const name = normalizeTag(parsed.data.name);
  if (name.length < 2) return NextResponse.json({ error: "Tag zu kurz" }, { status: 400 });
  const tag = await prisma.tag.upsert({
    where: { name },
    update: parsed.data.color ? { color: parsed.data.color } : {},
    create: { name, color: parsed.data.color ?? tagColorFor(name) },
  });
  return NextResponse.json({ tag });
}
