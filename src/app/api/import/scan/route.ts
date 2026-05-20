import { NextResponse } from "next/server";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { NextRequest } from "next/server";
import { enqueueIngest } from "@/lib/queue";
import { requireWriter } from "@/lib/auth-server";

export const dynamic = "force-dynamic";

const INGEST_DIR = process.env.INGEST_DIR ?? "/data/inbox";

/** POST /api/import/scan — manually scan the inbox folder and enqueue PDFs. */
export async function POST(req: NextRequest) {
  const auth = await requireWriter(req);
  if ("response" in auth) return auth.response;
  let entries: string[] = [];
  try {
    entries = await readdir(INGEST_DIR);
  } catch {
    return NextResponse.json({ error: `Import-Ordner ${INGEST_DIR} nicht erreichbar` }, { status: 500 });
  }

  const pdfs = entries.filter((e) => e.toLowerCase().endsWith(".pdf"));
  for (const name of pdfs) {
    await enqueueIngest({
      filePath: path.join(INGEST_DIR, name),
      originalName: name,
      source: "folder",
    });
  }

  return NextResponse.json({ scanned: entries.length, enqueued: pdfs.length });
}
