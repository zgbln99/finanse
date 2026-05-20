import { cookies } from "next/headers";
import { prisma } from "./db";
import { isoWeekYear } from "./utils";

export const YEAR_COOKIE = "cockpit_year";

/** Active business year, from the cookie set by the top-bar switcher. */
export async function getActiveYear(): Promise<number> {
  const store = await cookies();
  const raw = store.get(YEAR_COOKIE)?.value;
  const parsed = raw ? Number(raw) : NaN;
  if (Number.isInteger(parsed) && parsed >= 2000 && parsed <= 2100) return parsed;
  return new Date().getFullYear();
}

/** Distinct years that have invoices (by invoice date), newest first. */
export async function getAvailableYears(): Promise<number[]> {
  const rows = await prisma.document.findMany({
    where: { invoiceDate: { not: null } },
    select: { invoiceDate: true },
  });
  const set = new Set<number>();
  for (const r of rows) set.add(isoWeekYear(r.invoiceDate as Date));
  const current = new Date().getFullYear();
  set.add(current); // always offer the current year, even when still empty
  return [...set].sort((a, b) => b - a);
}

/** [start, end) bounds for a calendar year. */
export function yearBounds(year: number): { gte: Date; lt: Date } {
  return { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) };
}
