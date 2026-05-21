import { prisma } from "./db";

function toNum(d: unknown): number {
  if (d == null) return 0;
  return typeof d === "object" && "toNumber" in (d as object)
    ? (d as { toNumber(): number }).toNumber()
    : Number(d);
}

/**
 * Rule-based duplicate + anomaly detection, run after each extraction.
 *  - Duplicate: same vendor + same invoice number, OR same vendor + same brutto
 *    within ±3 days.
 *  - Anomaly: brutto far above the vendor's historical average (>= 2.5x, with
 *    at least 3 prior invoices).
 */
export async function detectFlags(documentId: string): Promise<void> {
  const doc = await prisma.document.findUnique({ where: { id: documentId } });
  if (!doc || !doc.vendorName) return;

  const brutto = toNum(doc.bruttoAmount);
  let isDuplicate = false;
  let isAnomaly = false;
  const reasons: string[] = [];

  // --- Duplicate ---
  if (doc.invoiceNumber) {
    const sameNumber = await prisma.document.findFirst({
      where: {
        id: { not: doc.id },
        vendorName: doc.vendorName,
        invoiceNumber: doc.invoiceNumber,
      },
      select: { id: true },
    });
    if (sameNumber) {
      isDuplicate = true;
      reasons.push(`Mögliches Duplikat (gleiche Rechnungsnr. ${doc.invoiceNumber})`);
    }
  }
  if (!isDuplicate && brutto > 0 && doc.invoiceDate) {
    const from = new Date(doc.invoiceDate);
    from.setDate(from.getDate() - 3);
    const to = new Date(doc.invoiceDate);
    to.setDate(to.getDate() + 3);
    const candidates = await prisma.document.findMany({
      where: {
        id: { not: doc.id },
        vendorName: doc.vendorName,
        invoiceDate: { gte: from, lte: to },
      },
      select: { bruttoAmount: true },
    });
    if (candidates.some((c) => Math.abs(toNum(c.bruttoAmount) - brutto) < 0.01)) {
      isDuplicate = true;
      reasons.push("Mögliches Duplikat (gleicher Betrag & Zeitraum)");
    }
  }

  // --- Anomaly ---
  if (brutto > 0) {
    const history = await prisma.document.findMany({
      where: {
        id: { not: doc.id },
        vendorName: doc.vendorName,
        status: { in: ["completed", "needs_review"] },
        bruttoAmount: { not: null },
      },
      select: { bruttoAmount: true },
      take: 50,
    });
    if (history.length >= 3) {
      const vals = history.map((h) => toNum(h.bruttoAmount)).filter((v) => v > 0);
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
      if (avg > 0 && brutto >= avg * 2.5) {
        isAnomaly = true;
        reasons.push(
          `Betrag ungewöhnlich hoch (${brutto.toFixed(0)} € vs. Ø ${avg.toFixed(0)} €)`,
        );
      }
    }
  }

  await prisma.document.update({
    where: { id: documentId },
    data: {
      isDuplicate,
      isAnomaly,
      anomalyReason: reasons.length ? reasons.join("; ") : null,
    },
  });
}
