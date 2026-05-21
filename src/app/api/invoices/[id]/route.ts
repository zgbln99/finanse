import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { requireWriter } from "@/lib/auth-server";
import { normalizeVendor } from "@/lib/utils";
import { normalizeTag, tagColorFor } from "@/lib/tags";

export const dynamic = "force-dynamic";

const PatchSchema = z.object({
  vendorName: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  street: z.string().nullable().optional(),
  postalCode: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
  invoiceNumber: z.string().nullable().optional(),
  invoiceDate: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  paid: z.boolean().optional(),
  nettoAmount: z.number().nullable().optional(),
  vatAmount: z.number().nullable().optional(),
  bruttoAmount: z.number().nullable().optional(),
  currency: z.string().optional(),
  documentType: z
    .enum(["rechnung", "gutschrift", "mahnung", "angebot", "lieferschein", "sonstiges"])
    .nullable()
    .optional(),
  isRecurring: z.boolean().optional(),
  reviewed: z.boolean().optional(),
  note: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
});

const MEMORY_FIELDS = new Set(["documentType", "currency", "city", "country", "isRecurring"]);

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const doc = await prisma.document.findUnique({
    where: { id },
    include: {
      tags: { include: { tag: true } },
      vendor: true,
      auditLogs: { orderBy: { createdAt: "desc" }, take: 50 },
    },
  });
  if (!doc) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  return NextResponse.json(serialize(doc));
}

/** PATCH — manual field correction; records audit + AI correction memory. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireWriter(req);
  if ("response" in auth) return auth.response;
  const { id } = await params;
  const actor = auth.user.email;
  const body = PatchSchema.parse(await req.json());

  const before = await prisma.document.findUnique({ where: { id } });
  if (!before) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

  const data: Record<string, unknown> = {};
  const scalarFields: (keyof typeof body)[] = [
    "vendorName", "city", "street", "postalCode", "country",
    "invoiceNumber", "currency", "documentType", "isRecurring", "reviewed",
    "nettoAmount", "vatAmount", "bruttoAmount", "note",
  ];

  for (const f of scalarFields) {
    if (body[f] === undefined) continue;
    data[f] = body[f];
    const oldVal = (before as Record<string, unknown>)[f];
    const newVal = body[f];
    if (String(oldVal ?? "") !== String(newVal ?? "")) {
      await logAudit({
        documentId: id,
        action: "field_corrected",
        field: f,
        oldValue: oldVal == null ? null : String(oldVal),
        newValue: newVal == null ? null : String(newVal),
        actor,
      });
      // Learn the correction for this vendor.
      const vendorKey = normalizeVendor(body.vendorName ?? before.vendorName ?? "");
      if (vendorKey && MEMORY_FIELDS.has(f as string)) {
        await prisma.correctionMemory.upsert({
          where: {
            vendorKey_field_fromValue: {
              vendorKey,
              field: f as string,
              fromValue: oldVal == null ? "" : String(oldVal),
            },
          },
          update: { toValue: String(newVal ?? ""), hitCount: { increment: 1 } },
          create: {
            vendorKey,
            field: f as string,
            fromValue: oldVal == null ? "" : String(oldVal),
            toValue: String(newVal ?? ""),
          },
        });
      }
    }
  }

  if (body.invoiceDate !== undefined) {
    data.invoiceDate = body.invoiceDate ? new Date(body.invoiceDate) : null;
  }
  if (body.dueDate !== undefined) {
    data.dueDate = body.dueDate ? new Date(body.dueDate) : null;
  }
  if (body.paid !== undefined) {
    data.paidAt = body.paid ? new Date() : null;
  }
  if (body.reviewed) {
    data.reviewed = true;
    data.reviewedAt = new Date();
    if (before.status === "needs_review") data.status = "completed";
  }

  await prisma.document.update({ where: { id }, data });

  // Tag sync (manual tags).
  if (body.tags) {
    const normalized = Array.from(new Set(body.tags.map(normalizeTag).filter((t) => t.length >= 3)));
    await prisma.documentTag.deleteMany({ where: { documentId: id } });
    for (const name of normalized) {
      const tag = await prisma.tag.upsert({
        where: { name },
        update: {},
        create: { name, color: tagColorFor(name) },
      });
      await prisma.documentTag.create({ data: { documentId: id, tagId: tag.id, source: "manual" } });
    }
  }

  await logAudit({ documentId: id, action: "reviewed", actor });

  const updated = await prisma.document.findUnique({
    where: { id },
    include: { tags: { include: { tag: true } }, vendor: true, auditLogs: { orderBy: { createdAt: "desc" }, take: 50 } },
  });
  return NextResponse.json(serialize(updated));
}

function serialize(d: any) {
  return {
    ...d,
    nettoAmount: d.nettoAmount ? Number(d.nettoAmount) : null,
    vatAmount: d.vatAmount ? Number(d.vatAmount) : null,
    bruttoAmount: d.bruttoAmount ? Number(d.bruttoAmount) : null,
    tags: d.tags?.map((t: any) => ({ name: t.tag.name, color: t.tag.color, source: t.source })) ?? [],
  };
}
