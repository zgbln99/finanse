import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const exec = promisify(execFile);

export type OcrResult = {
  text: string;
  engine: string;
  pageCount: number | null;
  /** Base64-encoded PNGs of the first pages, for vision-based AI extraction. */
  images: string[];
};

const MAX_RENDER_PAGES = 3;
const RENDER_DPI = 220;

/** Strip NUL (0x00) bytes that OCR can emit — Postgres TEXT columns reject them. */
function stripNul(s: string): string {
  return s.split(String.fromCharCode(0)).join("");
}

/**
 * OCR pipeline for invoices:
 *  1. Read the digital text layer with pdf-parse (instant, lossless).
 *  2. Always rasterize the first pages (poppler `pdftoppm`) — used both for the
 *     vision model and as Tesseract input.
 *  3. If the text layer is weak (scanned PDF), OCR the page images with the
 *     system Tesseract (German + English).
 */
export async function runPdfOcr(
  filePath: string,
  lang = process.env.OCR_LANG ?? "deu+eng",
): Promise<OcrResult> {
  const buf = await readFile(filePath);

  // 1) Digital text layer.
  let text = "";
  let pageCount: number | null = null;
  try {
    const { default: pdfParse } = await import("pdf-parse");
    const parsed = await pdfParse(buf);
    text = (parsed.text ?? "").trim();
    pageCount = parsed.numpages ?? null;
  } catch {
    /* corrupt text layer — fall back to OCR below */
  }

  // 2) Rasterize first pages.
  const rendered = await rasterize(buf);
  const images = rendered.map((r) => r.buffer.toString("base64"));

  // 3) Tesseract fallback when the text layer is too thin.
  let engine = "pdf-text";
  if (text.replace(/\s/g, "").length < 60 && rendered.length > 0) {
    const ocrParts: string[] = [];
    for (const r of rendered) {
      try {
        ocrParts.push(await tesseract(r.path, lang));
      } catch {
        /* tesseract missing or failed — keep going */
      }
    }
    const ocrText = ocrParts.join("\n\n").trim();
    if (ocrText.length > text.length) {
      text = ocrText;
      engine = `tesseract:${lang}`;
    }
  }

  await cleanup(rendered);
  return {
    text: stripNul(text),
    engine,
    pageCount: pageCount ?? (rendered.length || null),
    images,
  };
}

type Rendered = { path: string; buffer: Buffer; dir: string };

async function rasterize(buf: Buffer): Promise<Rendered[]> {
  let dir: string;
  try {
    dir = await mkdtemp(path.join(tmpdir(), "ocr-"));
  } catch {
    return [];
  }
  const input = path.join(dir, "in.pdf");
  await writeFile(input, buf);
  try {
    await exec("pdftoppm", [
      "-png",
      "-r", String(RENDER_DPI),
      "-f", "1",
      "-l", String(MAX_RENDER_PAGES),
      input,
      path.join(dir, "page"),
    ]);
  } catch {
    // poppler not installed (e.g. local dev) — no images, text layer only.
    await rm(dir, { recursive: true, force: true }).catch(() => {});
    return [];
  }
  const files = (await readdir(dir)).filter((f) => f.endsWith(".png")).sort();
  const out: Rendered[] = [];
  for (const f of files.slice(0, MAX_RENDER_PAGES)) {
    const p = path.join(dir, f);
    out.push({ path: p, buffer: await readFile(p), dir });
  }
  return out;
}

async function tesseract(imagePath: string, lang: string): Promise<string> {
  const { stdout } = await exec("tesseract", [imagePath, "stdout", "-l", lang], {
    maxBuffer: 20 * 1024 * 1024,
  });
  return stdout;
}

async function cleanup(rendered: Rendered[]) {
  const dirs = new Set(rendered.map((r) => r.dir));
  for (const d of dirs) await rm(d, { recursive: true, force: true }).catch(() => {});
}
