import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const GF1_NAME = process.env.GF1_NAME ?? "Geschäftsführung 1";
const GF2_NAME = process.env.GF2_NAME ?? "Geschäftsführung 2";

const BodySchema = z.object({
  slot: z.union([z.literal(1), z.literal(2)]),
  approve: z.boolean(),
});

/** POST — toggle one of the two managing-director approval slots for a KW review. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { slot, approve } = BodySchema.parse(await req.json());
  const by = slot === 1 ? GF1_NAME : GF2_NAME;

  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

  const now = approve ? new Date() : null;
  const data =
    slot === 1
      ? { gf1ApprovedAt: now, gf1ApprovedBy: approve ? by : null }
      : { gf2ApprovedAt: now, gf2ApprovedBy: approve ? by : null };

  const updated = await prisma.document.update({ where: { id }, data });

  await logAudit({
    documentId: id,
    action: "approved",
    field: `gf${slot}`,
    newValue: approve ? `freigegeben durch ${by}` : "Freigabe zurückgezogen",
    actor: by,
  });

  const fullyApproved = Boolean(updated.gf1ApprovedAt && updated.gf2ApprovedAt);
  // When both directors have signed off, mark the document reviewed/completed.
  if (fullyApproved && updated.status === "needs_review") {
    await prisma.document.update({
      where: { id },
      data: { reviewed: true, reviewedAt: new Date(), status: "completed" },
    });
  }

  return NextResponse.json({
    id,
    gf1ApprovedBy: updated.gf1ApprovedBy,
    gf1ApprovedAt: updated.gf1ApprovedAt ? updated.gf1ApprovedAt.toISOString() : null,
    gf2ApprovedBy: updated.gf2ApprovedBy,
    gf2ApprovedAt: updated.gf2ApprovedAt ? updated.gf2ApprovedAt.toISOString() : null,
    fullyApproved,
  });
}
