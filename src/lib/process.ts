import { mkdir, copyFile, stat } from "node:fs/promises";
import path from "node:path";
import { prisma } from "./db";
import { fileChecksum } from "./checksum";
import { runPdfOcr } from "./ocr";
import { extractInvoiceFields, type ExtractionResult } from "./extraction";
import { isOpenAIConfigured } from "./openai";
import { detectFlags } from "./flags";
import { logAudit } from "./audit";
import { normalizeVendor } from "./utils";
import { tagColorFor } from "./tags";

const STORAGE_DIR = process.env.STORAGE_DIR ?? "/data/storage";
const CONFIDENCE_THRESHOLD = Number(process.env.AI_CONFIDENCE_THRESHOLD ?? "0.8");

export type IngestInput = {
  filePath: string;
  originalName: string;
  source: "folder" | "drive" | "upload";
};

/** Create a Document row from a file, deduplicating by checksum. */
export async function registerDocument(input: IngestInput) {
  const checksum = await fileChecksum(input.filePath);
  const existing = await prisma.document.findUnique({ where: { checksum } });
  if (existing) {
    return { document: existing, duplicate: true as const };
  }

  const info = await stat(input.filePath);
  const document = await prisma.document.create({
    data: {
      sourcePath: input.filePath,
      originalName: input.originalName,
      checksum,
      fileSize: info.size,
      source: input.source,
      status: "pending",
    },
  });
  await logAudit({ documentId: document.id, action: "created", newValue: input.originalName });
  return { document, duplicate: false as const };
}

/** Run the full OCR + AI pipeline for a registered document. */
export async function processDocument(documentId: string) {
  const doc = await prisma.document.findUnique({ where: { id: documentId } });
  if (!doc) throw new Error(`Document ${documentId} not found`);

  await prisma.document.update({
    where: { id: documentId },
    data: { status: "processing", errorMessage: null },
  });

  try {
    // --- OCR --- (prefer the managed storage copy)
    const ocr = await runPdfOcr(doc.storedPath ?? doc.sourcePath);
    await prisma.document.update({
      where: { id: documentId },
      data: { ocrText: ocr.text, ocrEngine: ocr.engine, pageCount: ocr.pageCount },
    });
    await logAudit({ documentId, action: "ocr_completed", newValue: ocr.engine });

    // --- Move file into managed storage (dedup-safe by checksum name) ---
    const storedPath = await moveToStorage(doc.sourcePath, doc.checksum);
    await prisma.document.update({ where: { id: documentId }, data: { storedPath } });

    // --- AI extraction ---
    if (!isOpenAIConfigured()) {
      await prisma.document.update({
        where: { id: documentId },
        data: { status: "needs_review", errorMessage: "OPENAI_API_KEY not configured" },
      });
      return;
    }

    let extracted = await extractInvoiceFields(ocr.text, ocr.images);
    extracted = await applyCorrectionMemory(extracted);
    await logAudit({ documentId, action: "ai_extracted", actor: "ai", meta: extracted as object });

    await persistExtraction(documentId, extracted);
    await detectFlags(documentId);

    const needsReview = (extracted.confidence ?? 0) < CONFIDENCE_THRESHOLD;
    await prisma.document.update({
      where: { id: documentId },
      data: { status: needsReview ? "needs_review" : "completed" },
    });
    await logAudit({
      documentId,
      action: "status_changed",
      newValue: needsReview ? "needs_review" : "completed",
      meta: { confidence: extracted.confidence },
    });
  } catch (err) {
    const message = (err as Error).message;
    await prisma.document.update({
      where: { id: documentId },
      data: { status: "failed", errorMessage: message },
    });
    await logAudit({ documentId, action: "status_changed", newValue: "failed", meta: { error: message } });
    throw err;
  }
}

async function moveToStorage(sourcePath: string, checksum: string): Promise<string> {
  await mkdir(STORAGE_DIR, { recursive: true });
  const dest = path.join(STORAGE_DIR, `${checksum}.pdf`);
  try {
    // Copy (not move) so the rclone-synced inbox mirror stays intact and the
    // same file is not re-downloaded on the next sync cycle.
    await copyFile(sourcePath, dest);
  } catch {
    return sourcePath;
  }
  return dest;
}

/** Apply learned per-vendor corrections to a fresh extraction. */
async function applyCorrectionMemory(ex: ExtractionResult): Promise<ExtractionResult> {
  if (!ex.vendorName) return ex;
  const vendorKey = normalizeVendor(ex.vendorName);
  const memories = await prisma.correctionMemory.findMany({ where: { vendorKey } });
  for (const m of memories) {
    const current = (ex as Record<string, unknown>)[m.field];
    if (m.fromValue == null || String(current ?? "") === m.fromValue) {
      (ex as Record<string, unknown>)[m.field] = m.toValue;
    }
  }
  return ex;
}

async function persistExtraction(documentId: string, ex: ExtractionResult) {
  // Resolve / create vendor.
  let vendorId: string | null = null;
  if (ex.vendorName) {
    const normalized = normalizeVendor(ex.vendorName);
    const vendor = await prisma.vendor.upsert({
      where: { normalized },
      update: {
        city: ex.city ?? undefined,
        street: ex.street ?? undefined,
        postalCode: ex.postalCode ?? undefined,
        country: ex.country ?? undefined,
      },
      create: {
        name: ex.vendorName,
        normalized,
        city: ex.city,
        street: ex.street,
        postalCode: ex.postalCode,
        country: ex.country,
      },
    });
    vendorId = vendor.id;
  }

  await prisma.document.update({
    where: { id: documentId },
    data: {
      vendorId,
      vendorName: ex.vendorName,
      city: ex.city,
      street: ex.street,
      postalCode: ex.postalCode,
      country: ex.country,
      invoiceNumber: ex.invoiceNumber,
      invoiceDate: ex.invoiceDate ? new Date(ex.invoiceDate) : null,
      dueDate: ex.dueDate ? new Date(ex.dueDate) : null,
      nettoAmount: ex.nettoAmount ?? undefined,
      vatAmount: ex.vatAmount ?? undefined,
      bruttoAmount: ex.bruttoAmount ?? undefined,
      currency: ex.currency ?? "EUR",
      documentType: ex.documentType ?? undefined,
      confidence: ex.confidence,
      fieldConfidence: ex.fieldConfidence,
      isRecurring: ex.isRecurring,
      aiModel: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
    },
  });

  // Sync tags.
  await prisma.documentTag.deleteMany({ where: { documentId, source: "ai" } });
  for (const name of ex.tags) {
    const tag = await prisma.tag.upsert({
      where: { name },
      update: {},
      create: { name, color: tagColorFor(name) },
    });
    await prisma.documentTag.upsert({
      where: { documentId_tagId: { documentId, tagId: tag.id } },
      update: {},
      create: { documentId, tagId: tag.id, source: "ai" },
    });
  }
}
