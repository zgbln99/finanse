import { PrismaClient, type DocumentType } from "@prisma/client";
import { SEED_TAGS } from "../src/lib/tags";
import { normalizeVendor } from "../src/lib/utils";

const prisma = new PrismaClient();

const DEMO_VENDORS = [
  { name: "Vodafone GmbH", city: "Düsseldorf", tags: ["mobilfunk"], type: "rechnung", recurring: true, base: 480 },
  { name: "Shell Deutschland Oil GmbH", city: "Hamburg", tags: ["kraftstoff"], type: "rechnung", recurring: true, base: 3200 },
  { name: "Toll Collect GmbH", city: "Berlin", tags: ["maut"], type: "rechnung", recurring: true, base: 5400 },
  { name: "DKV Mobility", city: "Ratingen", tags: ["kraftstoff", "maut"], type: "rechnung", recurring: true, base: 4100 },
  { name: "Hetzner Online GmbH", city: "Gunzenhausen", tags: ["hosting", "softwareabo"], type: "rechnung", recurring: true, base: 120 },
  { name: "DATEV eG", city: "Nürnberg", tags: ["softwareabo"], type: "rechnung", recurring: true, base: 340 },
  { name: "TÜV SÜD AG", city: "München", tags: ["fahrzeugpruefung"], type: "rechnung", recurring: false, base: 890 },
  { name: "Mr. Wash AG", city: "Essen", tags: ["fahrzeugwaesche"], type: "rechnung", recurring: false, base: 210 },
  { name: "DB Schenker", city: "Essen", tags: ["fracht"], type: "rechnung", recurring: false, base: 2700 },
  { name: "Allianz Versicherung", city: "München", tags: ["versicherung"], type: "rechnung", recurring: true, base: 1500 },
];

function jitter(base: number) {
  return Math.round((base * (0.85 + Math.random() * 0.4)) * 100) / 100;
}

async function main() {
  console.log("[seed] tags");
  for (const t of SEED_TAGS) {
    await prisma.tag.upsert({ where: { name: t.name }, update: { color: t.color }, create: t });
  }

  const docCount = await prisma.document.count();
  if (docCount > 0) {
    console.log(`[seed] ${docCount} documents already present, skipping demo data`);
    return;
  }

  console.log("[seed] demo vendors + invoices (14 months of history)");
  const now = new Date();
  let counter = 1;

  for (const v of DEMO_VENDORS) {
    const vendor = await prisma.vendor.upsert({
      where: { normalized: normalizeVendor(v.name) },
      update: {},
      create: { name: v.name, normalized: normalizeVendor(v.name), city: v.city, country: "Deutschland" },
    });

    for (let monthsAgo = 13; monthsAgo >= 0; monthsAgo--) {
      if (!v.recurring && Math.random() > 0.45) continue;
      const date = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1 + Math.floor(Math.random() * 26));
      const netto = jitter(v.base);
      const vat = Math.round(netto * 0.19 * 100) / 100;
      const brutto = Math.round((netto + vat) * 100) / 100;

      const doc = await prisma.document.create({
        data: {
          sourcePath: `/data/inbox/demo-${counter}.pdf`,
          storedPath: `/data/storage/demo-${counter}.pdf`,
          originalName: `${v.name.split(" ")[0].toLowerCase()}-${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}.pdf`,
          checksum: `demo-${counter}-${Math.random().toString(36).slice(2)}`,
          fileSize: 50_000 + Math.floor(Math.random() * 80_000),
          source: "folder",
          status: Math.random() < 0.1 ? "needs_review" : "completed",
          ocrText: `${v.name}\nRechnung Nr. R-${date.getFullYear()}-${counter}\nNetto ${netto} EUR\nMwSt 19% ${vat} EUR\nBrutto ${brutto} EUR`,
          ocrEngine: "pdf-text",
          pageCount: 1,
          vendorId: vendor.id,
          vendorName: v.name,
          city: v.city,
          country: "Deutschland",
          invoiceNumber: `R-${date.getFullYear()}-${1000 + counter}`,
          invoiceDate: date,
          nettoAmount: netto,
          vatAmount: vat,
          bruttoAmount: brutto,
          currency: "EUR",
          documentType: v.type as DocumentType,
          confidence: Math.random() < 0.1 ? 0.6 : 0.9 + Math.random() * 0.09,
          isRecurring: v.recurring,
          aiModel: "gpt-4.1-mini",
        },
      });

      for (const tagName of v.tags) {
        const tag = await prisma.tag.findUnique({ where: { name: tagName } });
        if (tag) {
          await prisma.documentTag.create({ data: { documentId: doc.id, tagId: tag.id, source: "ai" } });
        }
      }
      counter++;
    }
  }
  console.log(`[seed] created ${counter - 1} demo invoices`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
