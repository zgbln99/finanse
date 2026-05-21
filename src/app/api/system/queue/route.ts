import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getIngestQueue } from "@/lib/queue";

export const dynamic = "force-dynamic";

export async function GET() {
  let queue = { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 };
  let redisOk = true;
  try {
    const counts = await getIngestQueue().getJobCounts(
      "waiting", "active", "completed", "failed", "delayed",
    );
    queue = {
      waiting: counts.waiting ?? 0,
      active: counts.active ?? 0,
      completed: counts.completed ?? 0,
      failed: counts.failed ?? 0,
      delayed: counts.delayed ?? 0,
    };
  } catch {
    redisOk = false;
  }

  const grouped = await prisma.document.groupBy({ by: ["status"], _count: { _all: true } });
  const documents: Record<string, number> = {};
  for (const g of grouped) documents[g.status] = g._count._all;

  const recentFailed = await prisma.document.findMany({
    where: { status: "failed" },
    orderBy: { updatedAt: "desc" },
    take: 10,
    select: { id: true, originalName: true, errorMessage: true, updatedAt: true },
  });

  return NextResponse.json({ redisOk, queue, documents, recentFailed });
}
