import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Public, no-login PDF stream addressed by share token. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const doc = await prisma.document.findUnique({ where: { shareToken: token } });
  if (!doc) return NextResponse.json({ error: "Link ungültig" }, { status: 404 });

  const filePath = doc.storedPath ?? doc.sourcePath;
  try {
    const buf = await readFile(filePath);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${encodeURIComponent(doc.originalName)}"`,
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch {
    return NextResponse.json({ error: "PDF nicht verfügbar" }, { status: 404 });
  }
}
