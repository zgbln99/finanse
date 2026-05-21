import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

function toNum(d: unknown): number {
  if (d == null) return 0;
  return typeof d === "object" && "toNumber" in (d as object)
    ? (d as { toNumber(): number }).toNumber()
    : Number(d);
}

/** GET /api/vendors — totals per vendor for the active year (cookie), searchable. */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim().toLowerCase();
  const year = Number(req.cookies.get("cockpit_year")?.value) || new Date().getFullYear();

  const where: Prisma.DocumentWhereInput = {
    status: { in: ["completed", "needs_review"] },
    vendorName: { not: null },
    invoiceDate: { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) },
  };

  const grouped = await prisma.document.groupBy({
    by: ["vendorName"],
    where,
    _sum: { bruttoAmount: true, nettoAmount: true },
    _count: { _all: true },
    _max: { invoiceDate: true },
  });

  let vendors = grouped.map((g) => ({
    vendor: g.vendorName as string,
    brutto: Math.round(toNum(g._sum.bruttoAmount) * 100) / 100,
    netto: Math.round(toNum(g._sum.nettoAmount) * 100) / 100,
    count: g._count._all,
    lastInvoice: g._max.invoiceDate ? (g._max.invoiceDate as Date).toISOString() : null,
  }));

  if (q) vendors = vendors.filter((v) => v.vendor.toLowerCase().includes(q));
  vendors.sort((a, b) => b.brutto - a.brutto);

  const total = vendors.reduce((s, v) => s + v.brutto, 0);
  return NextResponse.json({ year, vendors, total: Math.round(total * 100) / 100 });
}
