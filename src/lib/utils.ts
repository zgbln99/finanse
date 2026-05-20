import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const EUR = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
});

export function formatCurrency(value: number | null | undefined, currency = "EUR") {
  if (value == null) return "—";
  return new Intl.NumberFormat("de-DE", { style: "currency", currency }).format(value);
}

export function formatDate(value: Date | string | null | undefined) {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(d);
}

/** ISO week number (Kalenderwoche / KW). */
export function isoWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
}

export function normalizeVendor(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(gmbh|ag|kg|ohg|ug|se|co\.?|mbh|e\.?k\.?)\b/g, "")
    .replace(/[^a-z0-9äöüß ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function toNumber(value: unknown): number | null {
  if (value == null) return null;
  const n = typeof value === "string" ? Number(value) : (value as number);
  return Number.isFinite(n) ? n : null;
}
