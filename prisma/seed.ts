import { PrismaClient } from "@prisma/client";
import { SEED_TAGS } from "../src/lib/tags";

const prisma = new PrismaClient();

/**
 * Production seed: only the curated set of semantic German business tags.
 * No demo invoices — the cockpit starts empty and is filled with real PDFs.
 */
async function main() {
  console.log("[seed] tags");
  for (const t of SEED_TAGS) {
    await prisma.tag.upsert({ where: { name: t.name }, update: { color: t.color }, create: t });
  }
  console.log(`[seed] ${SEED_TAGS.length} tags ready`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
