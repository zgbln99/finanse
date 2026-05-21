import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { renderPdfPage } from "@/lib/region-ocr";

export const dynamic = "force-dynamic";

/** Renders page N of the invoice PDF as a PNG (for the region picker). */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string; n: string }> }) {
  const { id, n } = await params;
  const page = Math.max(1, Math.min(50, Number(n) || 1));
  const doc = await prisma.document.findUnique({
    where: { id },
    select: { storedPath: true, sourcePath: true },
  });
  if (!doc) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

  const png = await renderPdfPage(doc.storedPath ?? doc.sourcePath, page);
  if (!png) return NextResponse.json({ error: "Seite nicht verfügbar" }, { status: 404 });
  return new NextResponse(new Uint8Array(png), {
    headers: { "Content-Type": "image/png", "Cache-Control": "private, max-age=3600" },
  });
}
