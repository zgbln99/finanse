import { prisma } from "./db";
import { isoWeek, isoWeekYear, isoWeekRange, formatDayMonth } from "./utils";

function toNum(d: unknown): number {
  if (d == null) return 0;
  return typeof d === "object" && "toNumber" in (d as object)
    ? (d as { toNumber(): number }).toNumber()
    : Number(d);
}

export type KwInvoice = {
  id: string;
  vendorName: string | null;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  netto: number | null;
  vat: number | null;
  brutto: number | null;
  currency: string;
  documentType: string | null;
  status: string;
  tags: { name: string; color: string }[];
  reviewStatus: string | null; // "ok" | "nok" | null
  note: string | null;
};

export type KwGroup = {
  week: number;
  label: string; // "KW 21"
  range: string; // "19.05–25.05"
  netto: number;
  brutto: number;
  count: number;
  okCount: number;
  nokCount: number;
  openCount: number;
  invoices: KwInvoice[];
};

export type KwOverview = {
  year: number;
  years: number[];
  totalBrutto: number;
  totalCount: number;
  okCount: number;
  nokCount: number;
  openCount: number;
  groups: KwGroup[];
};

/** Build the KW (Kalenderwoche) control overview for a given ISO week-year. */
export async function getKwOverview(year: number): Promise<KwOverview> {
  // Available years (by invoice date) for the selector.
  const dated = await prisma.document.findMany({
    where: { invoiceDate: { not: null } },
    select: { invoiceDate: true },
  });
  const yearSet = new Set<number>();
  for (const d of dated) yearSet.add(isoWeekYear(d.invoiceDate as Date));
  if (yearSet.size === 0) yearSet.add(year);
  const years = [...yearSet].sort((a, b) => b - a);

  const docs = await prisma.document.findMany({
    where: { invoiceDate: { not: null }, status: { in: ["completed", "needs_review"] } },
    orderBy: { invoiceDate: "desc" },
    include: { tags: { include: { tag: true } } },
  });

  const groups = new Map<number, KwGroup>();
  let totalBrutto = 0;
  let totalCount = 0;
  let okCount = 0;
  let nokCount = 0;
  let openCount = 0;

  for (const d of docs) {
    const date = d.invoiceDate as Date;
    if (isoWeekYear(date) !== year) continue;
    const week = isoWeek(date);

    if (!groups.has(week)) {
      const { start, end } = isoWeekRange(year, week);
      groups.set(week, {
        week,
        label: `KW ${week}`,
        range: `${formatDayMonth(start)}–${formatDayMonth(end)}`,
        netto: 0,
        brutto: 0,
        count: 0,
        okCount: 0,
        nokCount: 0,
        openCount: 0,
        invoices: [],
      });
    }
    const g = groups.get(week)!;
    const brutto = toNum(d.bruttoAmount);

    g.netto += toNum(d.nettoAmount);
    g.brutto += brutto;
    g.count += 1;
    if (d.reviewStatus === "ok") {
      g.okCount += 1;
      okCount += 1;
    } else if (d.reviewStatus === "nok") {
      g.nokCount += 1;
      nokCount += 1;
    } else {
      g.openCount += 1;
      openCount += 1;
    }

    totalBrutto += brutto;
    totalCount += 1;

    g.invoices.push({
      id: d.id,
      vendorName: d.vendorName,
      invoiceNumber: d.invoiceNumber,
      invoiceDate: date.toISOString(),
      netto: d.nettoAmount ? toNum(d.nettoAmount) : null,
      vat: d.vatAmount ? toNum(d.vatAmount) : null,
      brutto: d.bruttoAmount ? brutto : null,
      currency: d.currency,
      documentType: d.documentType,
      status: d.status,
      tags: d.tags.map((t) => ({ name: t.tag.name, color: t.tag.color })),
      reviewStatus: d.reviewStatus,
      note: d.note,
    });
  }

  const sortedGroups = [...groups.values()].sort((a, b) => b.week - a.week);
  for (const g of sortedGroups) {
    g.netto = Math.round(g.netto * 100) / 100;
    g.brutto = Math.round(g.brutto * 100) / 100;
  }

  return {
    year,
    years,
    totalBrutto: Math.round(totalBrutto * 100) / 100,
    totalCount,
    okCount,
    nokCount,
    openCount,
    groups: sortedGroups,
  };
}
