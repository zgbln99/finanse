import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { enqueueIngest } from "@/lib/queue";
import { logAudit } from "@/lib/audit";
import { requireWriter } from "@/lib/auth-server";

export const dynamic = "force-dynamic";

/** POST — re-run OCR + AI extraction for an existing document. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireWriter(req);
  if ("response" in auth) return auth.response;
  const { id } = await params;

  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

  await prisma.document.update({ where: { id }, data: { status: "pending", errorMessage: null } });
  await logAudit({ documentId: id, action: "reprocessed", actor: auth.user.email });

  await enqueueIngest(
    {
      filePath: doc.storedPath ?? doc.sourcePath,
      originalName: doc.originalName,
      source: doc.source as "folder" | "drive" | "upload",
    },
    { jobId: `reprocess-${id}-${Date.now()}` },
  );

  return NextResponse.json({ ok: true });
}
