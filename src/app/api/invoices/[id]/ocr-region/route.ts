import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireWriter } from "@/lib/auth-server";
import { ocrRegion } from "@/lib/region-ocr";

export const dynamic = "force-dynamic";

const Body = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  w: z.number().min(0).max(1),
  h: z.number().min(0).max(1),
  page: z.number().int().min(1).max(20).default(1),
});

/** POST — OCR a manually selected region of the invoice and parse the amount. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireWriter(req);
  if ("response" in auth) return auth.response;
  const { id } = await params;

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Ungültige Auswahl" }, { status: 400 });

  const doc = await prisma.document.findUnique({ where: { id }, select: { storedPath: true, sourcePath: true } });
  if (!doc) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

  const pdf = doc.storedPath ?? doc.sourcePath;
  try {
    const result = await ocrRegion(pdf, parsed.data, parsed.data.page);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: "OCR fehlgeschlagen: " + (e as Error).message }, { status: 500 });
  }
}
