import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const exec = promisify(execFile);
const DPI = 200;

export type Rect = { x: number; y: number; w: number; h: number }; // relative 0..1

export type RegionResult = { raw: string; amount: number | null };

/**
 * Crop a rectangular region of a PDF page (relative coords) and OCR just that
 * area with Tesseract, then parse a monetary amount from it. Used by the manual
 * "read amount from selection" tool.
 */
export async function ocrRegion(
  pdfPath: string,
  rect: Rect,
  page = 1,
  lang = process.env.OCR_LANG ?? "deu+eng",
): Promise<RegionResult> {
  const dir = await mkdtemp(path.join(tmpdir(), "region-"));
  try {
    // 1) Render the full page to learn its pixel dimensions.
    await exec("pdftoppm", ["-png", "-r", String(DPI), "-f", String(page), "-l", String(page), pdfPath, path.join(dir, "full")]);
    const fullName = (await readdir(dir)).find((f) => f.startsWith("full") && f.endsWith(".png"));
    if (!fullName) return { raw: "", amount: null };
    const full = await readFile(path.join(dir, fullName));
    const width = full.readUInt32BE(16);
    const height = full.readUInt32BE(20);

    // 2) Crop region in pixels (clamped) and render just that area.
    const px = Math.max(0, Math.round(rect.x * width));
    const py = Math.max(0, Math.round(rect.y * height));
    const pw = Math.max(1, Math.min(width - px, Math.round(rect.w * width)));
    const ph = Math.max(1, Math.min(height - py, Math.round(rect.h * height)));
    await exec("pdftoppm", [
      "-png", "-r", String(DPI), "-f", String(page), "-l", String(page),
      "-x", String(px), "-y", String(py), "-W", String(pw), "-H", String(ph),
      pdfPath, path.join(dir, "crop"),
    ]);
    const cropName = (await readdir(dir)).find((f) => f.startsWith("crop") && f.endsWith(".png"));
    if (!cropName) return { raw: "", amount: null };

    // 3) OCR the crop, biased toward a single line of digits/currency.
    const { stdout } = await exec(
      "tesseract",
      [
        path.join(dir, cropName), "stdout",
        "-l", lang,
        "--psm", "6",
        "-c", "tessedit_char_whitelist=0123456789.,-€EUR ",
      ],
      { maxBuffer: 8 * 1024 * 1024 },
    );
    const raw = stdout.trim();
    return { raw, amount: parseGermanAmount(raw) };
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

/** Parse a German/European monetary string ("1.234,56 €") into a number. */
export function parseGermanAmount(s: string): number | null {
  const matches = s.match(/-?[\d.,]+/g);
  if (!matches) return null;
  // Pick the token with the most digits (most likely the amount).
  const token = matches.sort((a, b) => b.replace(/\D/g, "").length - a.replace(/\D/g, "").length)[0];
  let t = token.trim();
  const lastComma = t.lastIndexOf(",");
  const lastDot = t.lastIndexOf(".");
  if (lastComma >= 0 && lastDot >= 0) {
    // The later separator is the decimal mark; the other groups thousands.
    if (lastComma > lastDot) t = t.replace(/\./g, "").replace(",", ".");
    else t = t.replace(/,/g, "");
  } else if (lastComma >= 0) {
    t = t.replace(/\./g, "").replace(",", ".");
  } else {
    // Only dots: treat a single trailing ".dd" as decimal, else thousands.
    const parts = t.split(".");
    if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) t = parts.join("");
  }
  const n = Number(t);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}
