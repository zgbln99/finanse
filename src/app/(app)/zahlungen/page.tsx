import { prisma } from "@/lib/db";
import { getActiveYear } from "@/lib/year";
import { getCurrentUser } from "@/lib/auth-server";
import { canWrite } from "@/lib/auth";
import { PaymentsClient, type PaymentRow } from "@/components/payments/payments-client";

export const dynamic = "force-dynamic";

function toNum(d: unknown): number {
  if (d == null) return 0;
  return typeof d === "object" && "toNumber" in (d as object)
    ? (d as { toNumber(): number }).toNumber()
    : Number(d);
}

export default async function ZahlungenPage() {
  const [year, user] = await Promise.all([getActiveYear(), getCurrentUser()]);

  const docs = await prisma.document.findMany({
    where: {
      status: { in: ["completed", "needs_review"] },
      invoiceDate: { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) },
    },
    select: {
      id: true, vendorName: true, invoiceNumber: true, invoiceDate: true,
      dueDate: true, paidAt: true, bruttoAmount: true, currency: true,
    },
    orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }],
  });

  const rows: PaymentRow[] = docs.map((d) => ({
    id: d.id,
    vendorName: d.vendorName,
    invoiceNumber: d.invoiceNumber,
    invoiceDate: d.invoiceDate ? d.invoiceDate.toISOString() : null,
    dueDate: d.dueDate ? d.dueDate.toISOString() : null,
    paidAt: d.paidAt ? d.paidAt.toISOString() : null,
    brutto: toNum(d.bruttoAmount),
    currency: d.currency,
  }));

  return <PaymentsClient rows={rows} year={year} canWrite={canWrite(user?.role)} />;
}
