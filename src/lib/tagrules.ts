import { prisma } from "./db";
import { normalizeVendor } from "./utils";

/** Apply admin-defined auto-tagging rules to a freshly processed document. */
export async function applyTagRules(documentId: string): Promise<void> {
  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    select: { vendorName: true, ocrText: true },
  });
  if (!doc) return;

  const rules = await prisma.tagRule.findMany();
  if (rules.length === 0) return;

  const vendorHay = (doc.vendorName ?? "").toLowerCase() + " " + normalizeVendor(doc.vendorName ?? "");
  const textHay = (doc.ocrText ?? "").toLowerCase();

  for (const rule of rules) {
    const needle = rule.contains.toLowerCase().trim();
    if (!needle) continue;
    const hay = rule.field === "text" ? textHay : vendorHay;
    if (hay.includes(needle)) {
      await prisma.documentTag.upsert({
        where: { documentId_tagId: { documentId, tagId: rule.tagId } },
        update: {},
        create: { documentId, tagId: rule.tagId, source: "rule" },
      });
    }
  }
}
