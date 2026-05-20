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

export async function getDashboardStats() {
  const now = new Date();
  const year = now.getFullYear();
  const startOfYear = new Date(year, 0, 1);
  const startOfMonth = new Date(year, now.getMonth(), 1);
  const startOfLastMonth = new Date(year, now.getMonth() - 1, 1);
  const startOfThisMonth = startOfMonth;

  const docs = await prisma.document.findMany({
    where: { status: { in: [...COUNTED_STATUSES] }, invoiceDate: { not: null } },
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

  const rows = docs.map((d) => ({
    id: d.id,
    brutto: toNum(d.bruttoAmount),
    date: d.invoiceDate as Date,
    vendor: d.vendorName ?? "Unbekannt",
    recurring: d.isRecurring,
    tags: d.tags.map((t) => t.tag),
  }));

  const totalYear = sum(rows.filter((r) => r.date >= startOfYear));
  const totalThisMonth = sum(rows.filter((r) => r.date >= startOfThisMonth));
  const totalLastMonth = sum(
    rows.filter((r) => r.date >= startOfLastMonth && r.date < startOfThisMonth),
  );
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

  // Per Kalenderwoche (current year).
  const kwMap = new Map<number, number>();
  for (const r of rows.filter((x) => x.date >= startOfYear)) {
    const kw = isoWeek(r.date);
    kwMap.set(kw, (kwMap.get(kw) ?? 0) + r.brutto);
  }
  const byKW = [...kwMap.entries()]
    .map(([kw, total]) => ({ kw: `KW ${kw}`, total: round(total) }))
    .sort((a, b) => Number(a.kw.slice(3)) - Number(b.kw.slice(3)));

  // Monthly trend (last 14 months).
  const trend: { month: string; total: number; netto: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(year, now.getMonth() - i, 1);
    const next = new Date(year, now.getMonth() - i + 1, 1);
    const monthRows = rows.filter((r) => r.date >= d && r.date < next);
    trend.push({
      month: d.toLocaleDateString("de-DE", { month: "short", year: "2-digit" }),
      total: round(sum(monthRows)),
      netto: round(sum(monthRows)),
    });
  }

  // Largest invoices.
  const largest = [...rows]
    .sort((a, b) => b.brutto - a.brutto)
    .slice(0, 6)
    .map((r) => ({ id: r.id, vendor: r.vendor, amount: round(r.brutto), date: r.date }));

  // Recurring.
  const recurringVendors = byVendorRecurring(rows);

  // Heatmap: tag (rows) x month (cols), last 6 months.
  const heatmapMonths: string[] = [];
  for (let i = 5; i >= 0; i--) {
    heatmapMonths.push(
      new Date(year, now.getMonth() - i, 1).toLocaleDateString("de-DE", { month: "short" }),
    );
  }
  const topTagNames = byTag.slice(0, 6).map((t) => t.name);
  const heatmap = topTagNames.map((name) => {
    const cells = heatmapMonths.map((_, idx) => {
      const monthIndex = now.getMonth() - 5 + idx;
      const start = new Date(year, monthIndex, 1);
      const end = new Date(year, monthIndex + 1, 1);
      const total = rows
        .filter((r) => r.date >= start && r.date < end && r.tags.some((t) => t.name === name))
        .reduce((s, r) => s + r.brutto, 0);
      return round(total);
    });
    return { tag: name, cells };
  });

  const documentCount = await prisma.document.count();
  const reviewCount = await prisma.document.count({ where: { status: "needs_review" } });
  const failedCount = await prisma.document.count({ where: { status: "failed" } });
  const pendingCount = await prisma.document.count({
    where: { status: { in: ["pending", "processing"] } },
  });

  return {
    kpis: {
      totalYear: round(totalYear),
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
