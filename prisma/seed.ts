import { PrismaClient } from "@prisma/client";
import { SEED_TAGS } from "../src/lib/tags";
import { hashPassword } from "../src/lib/auth";

const prisma = new PrismaClient();

/**
 * Production seed: curated semantic tags + an initial admin user from env
 * (ADMIN_EMAIL / ADMIN_PASSWORD). No demo invoices.
 */
async function main() {
  console.log("[seed] tags");
  for (const t of SEED_TAGS) {
    await prisma.tag.upsert({ where: { name: t.name }, update: { color: t.color }, create: t });
  }
  console.log(`[seed] ${SEED_TAGS.length} tags ready`);

  const email = process.env.ADMIN_EMAIL?.toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (email && password) {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (!existing) {
      await prisma.user.create({
        data: { email, name: "Administrator", role: "admin", passwordHash: await hashPassword(password) },
      });
      console.log(`[seed] admin user created: ${email}`);
    } else {
      console.log(`[seed] admin user already exists: ${email}`);
    }
  } else {
    console.log("[seed] ADMIN_EMAIL / ADMIN_PASSWORD not set — skipping admin creation");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
