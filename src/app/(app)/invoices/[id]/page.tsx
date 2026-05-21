import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { InvoiceDetail } from "@/components/invoices/invoice-detail";
import { getCurrentUser } from "@/lib/auth-server";
import { canWrite } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const doc = await prisma.document.findUnique({
    where: { id },
    include: {
      tags: { include: { tag: true } },
      vendor: true,
      auditLogs: { orderBy: { createdAt: "desc" }, take: 50 },
    },
  });
  if (!doc) notFound();

  const serialized = {
    ...doc,
    nettoAmount: doc.nettoAmount ? Number(doc.nettoAmount) : null,
    vatAmount: doc.vatAmount ? Number(doc.vatAmount) : null,
    bruttoAmount: doc.bruttoAmount ? Number(doc.bruttoAmount) : null,
    invoiceDate: doc.invoiceDate ? doc.invoiceDate.toISOString() : null,
    dueDate: doc.dueDate ? doc.dueDate.toISOString() : null,
    paidAt: doc.paidAt ? doc.paidAt.toISOString() : null,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
    reviewedAt: doc.reviewedAt ? doc.reviewedAt.toISOString() : null,
    tags: doc.tags.map((t) => ({ name: t.tag.name, color: t.tag.color, source: t.source })),
    auditLogs: doc.auditLogs.map((l) => ({ ...l, createdAt: l.createdAt.toISOString() })),
  };

  const user = await getCurrentUser();
  return <InvoiceDetail initial={serialized} canWrite={canWrite(user?.role)} />;
}
