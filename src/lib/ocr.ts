import { readFile } from "node:fs/promises";

export type OcrResult = {
  text: string;
  engine: string;
  pageCount: number | null;
};

/**
 * Extract text from a PDF. Most B2B invoices are digital PDFs with a real text
 * layer, so we read that first (fast, lossless). For scanned/image-only PDFs
 * with no usable text layer we fall back to Tesseract OCR on the rendered page
 * images.
 */
export async function runPdfOcr(filePath: string, lang = process.env.OCR_LANG ?? "deu+eng"): Promise<OcrResult> {
  const buf = await readFile(filePath);

  // 1) Digital text layer via pdf-parse.
  const { default: pdfParse } = await import("pdf-parse");
  const parsed = await pdfParse(buf);
  const text = (parsed.text ?? "").trim();
  const pageCount = parsed.numpages ?? null;

  if (text.replace(/\s/g, "").length >= 40) {
    return { text, engine: "pdf-text", pageCount };
  }

  // 2) Fallback: rasterize + Tesseract for scanned documents.
  try {
    const images = await rasterizePdf(buf);
    if (images.length > 0) {
      const ocrText = await ocrImages(images, lang);
      if (ocrText.trim().length > 0) {
        return { text: ocrText.trim(), engine: `tesseract:${lang}`, pageCount: pageCount ?? images.length };
      }
    }
  } catch (err) {
    // Rasterization may be unavailable in minimal environments; surface the
    // digital-text result (possibly empty) and let the review queue catch it.
    console.warn("[ocr] tesseract fallback failed:", (err as Error).message);
  }

  return { text, engine: "pdf-text:empty", pageCount };
}

/** Render PDF pages to raw PNG buffers using pdfjs + node canvas if available. */
async function rasterizePdf(buf: Buffer): Promise<Buffer[]> {
  // pdfjs needs a canvas factory; we only attempt this if `canvas` is present.
  let createCanvas: ((w: number, h: number) => any) | null = null;
  try {
    // Optional native dependency. Absent in the slim default image.
    const mod = await import("canvas" as string);
    createCanvas = mod.createCanvas;
  } catch {
    return [];
  }
  if (!createCanvas) return [];
  const make = createCanvas;

  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf), disableWorker: true } as any).promise;
  const out: Buffer[] = [];
  const maxPages = Math.min(doc.numPages, 10);
  for (let i = 1; i <= maxPages; i++) {
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = make(viewport.width, viewport.height);
    const ctx = canvas.getContext("2d");
    await page.render({ canvasContext: ctx as any, viewport }).promise;
    out.push(canvas.toBuffer("image/png"));
  }
  return out;
}

async function ocrImages(images: Buffer[], lang: string): Promise<string> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker(lang);
  try {
    const parts: string[] = [];
    for (const img of images) {
      const { data } = await worker.recognize(img);
      parts.push(data.text);
    }
    return parts.join("\n\n");
  } finally {
    await worker.terminate();
  }
}
