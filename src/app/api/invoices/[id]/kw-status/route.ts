import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  status: z.enum(["ok", "nok"]).nullable(),
  note: z.string().nullable().optional(),
});

/** POST — set the KW review verdict (ok / nok / null) and optional uwagi. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = req.headers.get("x-user-email") ?? "fuhrparkmanagement@ltslogistik.de";
  const { status, note } = BodySchema.parse(await req.json());

  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

  const data: Record<string, unknown> = { reviewStatus: status };
  if (note !== undefined) data.note = note;
  // A verdict marks the document as reviewed and clears the review queue flag.
  if (status) {
    data.reviewed = true;
    data.reviewedAt = new Date();
    if (doc.status === "needs_review") data.status = "completed";
  }

  const updated = await prisma.document.update({ where: { id }, data });

  if (doc.reviewStatus !== status) {
    await logAudit({
      documentId: id,
      action: "reviewed",
      field: "reviewStatus",
      oldValue: doc.reviewStatus,
      newValue: status,
      actor,
    });
  }

  return NextResponse.json({
    id,
    reviewStatus: updated.reviewStatus,
    note: updated.note,
  });
}
