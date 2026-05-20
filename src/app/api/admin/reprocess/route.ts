import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { enqueueIngest } from "@/lib/queue";
import { requireWriter } from "@/lib/auth-server";

export const dynamic = "force-dynamic";

/** POST /api/admin/reprocess?scope=failed|review|year — bulk re-run extraction. */
export async function POST(req: NextRequest) {
  const auth = await requireWriter(req);
  if ("response" in auth) return auth.response;

  const scope = req.nextUrl.searchParams.get("scope") ?? "failed";
  const where: Prisma.DocumentWhereInput = {};
  if (scope === "failed") where.status = "failed";
  else if (scope === "review") where.status = "needs_review";
  else if (scope === "year") {
    const y = Number(req.cookies.get("cockpit_year")?.value) || new Date().getFullYear();
    where.invoiceDate = { gte: new Date(y, 0, 1), lt: new Date(y + 1, 0, 1) };
  }

  const docs = await prisma.document.findMany({
    where,
    select: { id: true, storedPath: true, sourcePath: true, originalName: true, source: true },
    take: 1000,
  });

  const now = Date.now();
  for (const d of docs) {
    await prisma.document.update({ where: { id: d.id }, data: { status: "pending", errorMessage: null } });
    await enqueueIngest(
      {
        filePath: d.storedPath ?? d.sourcePath,
        originalName: d.originalName,
        source: d.source as "folder" | "drive" | "upload",
      },
      { jobId: `reprocess-${d.id}-${now}` },
    );
  }

  return NextResponse.json({ enqueued: docs.length, scope });
}
