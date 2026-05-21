import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/auth";

const prisma = new PrismaClient();

/**
 * Creates or RESETS the admin account from ADMIN_EMAIL / ADMIN_PASSWORD.
 * Unlike the seed (create-if-missing), this always updates the password —
 * use it to recover access. Run:
 *   docker compose run --rm -e ADMIN_EMAIL=... -e ADMIN_PASSWORD=... migrate \
 *     npx tsx prisma/set-admin.ts
 */
async function main() {
  const email = process.env.ADMIN_EMAIL?.toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    console.error("[set-admin] ADMIN_EMAIL and ADMIN_PASSWORD are required");
    process.exit(1);
  }
  const passwordHash = await hashPassword(password);
  await prisma.user.upsert({
    where: { email },
    update: { passwordHash, role: "admin" },
    create: { email, name: "Administrator", role: "admin", passwordHash },
  });
  console.log(`[set-admin] admin ready: ${email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
