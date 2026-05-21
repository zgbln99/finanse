import { NextRequest } from "next/server";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import archiver from "archiver";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { isoWeek } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** GET /api/export/zip?kw=21 (or no kw = whole year) — ZIP of the stored PDFs. */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const year = Number(req.cookies.get("cockpit_year")?.value) || new Date().getFullYear();
  const kw = sp.get("kw") ? Number(sp.get("kw")) : null;

  const where: Prisma.DocumentWhereInput = {
    invoiceDate: { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) },
    storedPath: { not: null },
  };
  const docs = await prisma.document.findMany({
    where,
    select: { storedPath: true, vendorName: true, invoiceNumber: true, invoiceDate: true },
    orderBy: { invoiceDate: "asc" },
  });

  const archive = archiver("zip", { zlib: { level: 6 } });
  let added = 0;
  for (const d of docs) {
    if (!d.storedPath) continue;
    const date = d.invoiceDate as Date;
    if (kw && isoWeek(date) !== kw) continue;
    try {
      await stat(d.storedPath);
    } catch {
      continue;
    }
    const safeVendor = (d.vendorName ?? "Lieferant").replace(/[^a-zA-Z0-9äöüÄÖÜß _-]/g, "").slice(0, 40);
    const datePart = date.toISOString().slice(0, 10);
    const name = `KW${isoWeek(date)}/${datePart}_${safeVendor}_${(d.invoiceNumber ?? "").replace(/[^a-zA-Z0-9_-]/g, "")}.pdf`;
    archive.append(createReadStream(d.storedPath), { name });
    added++;
  }
  archive.finalize();

  const filename = kw ? `rechnungen-${year}-KW${kw}.zip` : `rechnungen-${year}.zip`;
  // Adapt the Node stream to a web ReadableStream for the Next response.
  const stream = new ReadableStream({
    start(controller) {
      archive.on("data", (chunk) => controller.enqueue(chunk));
      archive.on("end", () => controller.close());
      archive.on("error", (err) => controller.error(err));
    },
  });

  if (added === 0) {
    return new Response("Keine PDFs für diesen Zeitraum verfügbar", { status: 404 });
  }

  return new Response(stream, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
