import { prisma } from "./db";
import { isoWeek } from "./utils";

const COUNTED_STATUSES = ["completed", "needs_review"] as const;

function toNum(d: unknown): number {
  if (d == null) return 0;
  return typeof d === "object" && "toNumber" in (d as object)
    ? (d as { toNumber(): number }).toNumber()
    : Number(d);
}

export type DashboardStats = Awaited<ReturnType<typeof getDashboardStats>>;

export async function getDashboardStats(year: number = new Date().getFullYear()) {
  const now = new Date();
  const startOfYear = new Date(year, 0, 1);
  const endOfYear = new Date(year + 1, 0, 1);

  const docs = await prisma.document.findMany({
    where: {
      status: { in: [...COUNTED_STATUSES] },
      invoiceDate: { gte: startOfYear, lt: endOfYear },
    },
    select: {
      bruttoAmount: true,
      nettoAmount: true,
      vatAmount: true,
      invoiceDate: true,
      vendorName: true,
      isRecurring: true,
      currency: true,
      id: true,
      tags: { select: { tag: { select: { name: true, color: true } } } },
    },
    orderBy: { invoiceDate: "desc" },
  });

  // Previous year monthly totals for year-over-year comparison.
  const prevDocs = await prisma.document.findMany({
    where: {
      status: { in: [...COUNTED_STATUSES] },
      invoiceDate: { gte: new Date(year - 1, 0, 1), lt: startOfYear },
    },
    select: { bruttoAmount: true, invoiceDate: true },
  });
  const prevMonthly = new Array(12).fill(0);
  let totalPrevYear = 0;
  for (const d of prevDocs) {
    const v = toNum(d.bruttoAmount);
    prevMonthly[(d.invoiceDate as Date).getMonth()] += v;
    totalPrevYear += v;
  }

  const rows = docs.map((d) => ({
    id: d.id,
    brutto: toNum(d.bruttoAmount),
    date: d.invoiceDate as Date,
    vendor: d.vendorName ?? "Unbekannt",
    recurring: d.isRecurring,
    tags: d.tags.map((t) => t.tag),
  }));

  // Reference month: current month for the live year, otherwise the latest
  // month that actually has invoices in the selected (archive) year.
  const isCurrentYear = year === now.getFullYear();
  const monthsWithData = rows.map((r) => r.date.getMonth());
  const refMonth = isCurrentYear
    ? now.getMonth()
    : monthsWithData.length
      ? Math.max(...monthsWithData)
      : 11;

  const totalYear = sum(rows);
  const totalThisMonth = sum(rows.filter((r) => r.date.getMonth() === refMonth));
  const totalLastMonth = sum(rows.filter((r) => r.date.getMonth() === refMonth - 1));
  const momChange =
    totalLastMonth > 0 ? ((totalThisMonth - totalLastMonth) / totalLastMonth) * 100 : null;

  // Per-vendor.
  const byVendor = groupSum(rows, (r) => r.vendor);
  const topVendors = byVendor.slice(0, 8);

  // Per-tag.
  const tagMap = new Map<string, { name: string; color: string; total: number }>();
  for (const r of rows) {
    for (const t of r.tags) {
      const e = tagMap.get(t.name) ?? { name: t.name, color: t.color, total: 0 };
      e.total += r.brutto;
      tagMap.set(t.name, e);
    }
  }
  const byTag = [...tagMap.values()].sort((a, b) => b.total - a.total);

  // Per Kalenderwoche (selected year).
  const kwMap = new Map<number, number>();
  for (const r of rows) {
    const kw = isoWeek(r.date);
    kwMap.set(kw, (kwMap.get(kw) ?? 0) + r.brutto);
  }
  const byKW = [...kwMap.entries()]
    .map(([kw, total]) => ({ kw: `KW ${kw}`, total: round(total) }))
    .sort((a, b) => Number(a.kw.slice(3)) - Number(b.kw.slice(3)));

  // Monthly trend (12 months of the selected year) + previous-year overlay.
  const trend: { month: string; total: number; prev: number }[] = [];
  for (let m = 0; m < 12; m++) {
    const d = new Date(year, m, 1);
    const monthRows = rows.filter((r) => r.date.getMonth() === m);
    trend.push({
      month: d.toLocaleDateString("de-DE", { month: "short" }),
      total: round(sum(monthRows)),
      prev: round(prevMonthly[m]),
    });
  }

  // Forecast for the live year: run-rate from elapsed months × 12.
  const elapsedMonths = isCurrentYear ? now.getMonth() + 1 : 12;
  const forecast = elapsedMonths > 0 ? round((totalYear / elapsedMonths) * 12) : 0;
  const yoyChange =
    totalPrevYear > 0 ? round(((totalYear - totalPrevYear) / totalPrevYear) * 100) : null;

  // Largest invoices.
  const largest = [...rows]
    .sort((a, b) => b.brutto - a.brutto)
    .slice(0, 6)
    .map((r) => ({ id: r.id, vendor: r.vendor, amount: round(r.brutto), date: r.date }));

  // Recurring.
  const recurringVendors = byVendorRecurring(rows);

  // Heatmap: tag (rows) x month (cols), 12 months of the selected year.
  const heatmapMonths: string[] = [];
  for (let m = 0; m < 12; m++) {
    heatmapMonths.push(new Date(year, m, 1).toLocaleDateString("de-DE", { month: "narrow" }));
  }
  const topTagNames = byTag.slice(0, 6).map((t) => t.name);
  const heatmap = topTagNames.map((name) => {
    const cells = heatmapMonths.map((_, m) => {
      const total = rows
        .filter((r) => r.date.getMonth() === m && r.tags.some((t) => t.name === name))
        .reduce((s, r) => s + r.brutto, 0);
      return round(total);
    });
    return { tag: name, cells };
  });

  // Operational pipeline counts (not year-scoped — about processing health).
  const documentCount = rows.length;
  const reviewCount = await prisma.document.count({ where: { status: "needs_review" } });
  const failedCount = await prisma.document.count({ where: { status: "failed" } });
  const pendingCount = await prisma.document.count({
    where: { status: { in: ["pending", "processing"] } },
  });

  return {
    year,
    kpis: {
      totalYear: round(totalYear),
      totalPrevYear: round(totalPrevYear),
      yoyChange,
      forecast,
      totalThisMonth: round(totalThisMonth),
      totalLastMonth: round(totalLastMonth),
      momChange: momChange == null ? null : round(momChange),
      documentCount,
      reviewCount,
      failedCount,
      pendingCount,
      vendorCount: byVendor.length,
    },
    topVendors,
    byTag,
    byKW,
    trend,
    largest,
    recurringVendors,
    heatmap: { months: heatmapMonths, rows: heatmap },
  };
}

function sum(rows: { brutto: number }[]) {
  return rows.reduce((s, r) => s + r.brutto, 0);
}
function round(n: number) {
  return Math.round(n * 100) / 100;
}
function groupSum<T>(rows: T[], key: (r: T) => string) {
  const m = new Map<string, number>();
  for (const r of rows as { brutto: number }[] & T[]) {
    const k = key(r);
    m.set(k, (m.get(k) ?? 0) + (r as unknown as { brutto: number }).brutto);
  }
  return [...m.entries()]
    .map(([name, total]) => ({ name, total: round(total) }))
    .sort((a, b) => b.total - a.total);
}
function byVendorRecurring(rows: { vendor: string; recurring: boolean; brutto: number }[]) {
  const m = new Map<string, { vendor: string; count: number; total: number }>();
  for (const r of rows.filter((x) => x.recurring)) {
    const e = m.get(r.vendor) ?? { vendor: r.vendor, count: 0, total: 0 };
    e.count += 1;
    e.total += r.brutto;
    m.set(r.vendor, e);
  }
  return [...m.values()]
    .map((v) => ({ ...v, total: round(v.total) }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 6);
}
