import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const STORAGE_DIR = process.env.STORAGE_DIR ?? "/data/storage";

/** First-page PNG thumbnail (generated during processing). */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const doc = await prisma.document.findUnique({ where: { id }, select: { checksum: true } });
  if (!doc) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  try {
    const buf = await readFile(path.join(STORAGE_DIR, `${doc.checksum}.png`));
    return new NextResponse(new Uint8Array(buf), {
      headers: { "Content-Type": "image/png", "Cache-Control": "private, max-age=3600" },
    });
  } catch {
    return NextResponse.json({ error: "Keine Vorschau" }, { status: 404 });
  }
}
