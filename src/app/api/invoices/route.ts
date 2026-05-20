import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import type { Prisma, DocumentStatus, DocumentType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { enqueueIngest } from "@/lib/queue";

export const dynamic = "force-dynamic";

const INGEST_DIR = process.env.INGEST_DIR ?? "/data/inbox";

/** GET /api/invoices — filterable, searchable, paginated list. */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const q = sp.get("q")?.trim();
  const status = sp.get("status") as DocumentStatus | null;
  const type = sp.get("type") as DocumentType | null;
  const tag = sp.get("tag");
  const vendor = sp.get("vendor");
  const city = sp.get("city");
  const reviewStatus = sp.get("reviewStatus"); // ok | nok | open
  const dateFrom = sp.get("dateFrom");
  const dateTo = sp.get("dateTo");
  const amountMin = sp.get("amountMin");
  const amountMax = sp.get("amountMax");
  const format = sp.get("format");
  const page = Math.max(1, Number(sp.get("page") ?? "1"));
  const pageSize = Math.min(100, Number(sp.get("pageSize") ?? "25"));

  const where: Prisma.DocumentWhereInput = {};

  // Year scope from the global switcher cookie (invoices dated in that year).
  const yearCookie = Number(req.cookies.get("cockpit_year")?.value);
  if (Number.isInteger(yearCookie) && yearCookie >= 2000 && yearCookie <= 2100) {
    where.invoiceDate = { gte: new Date(yearCookie, 0, 1), lt: new Date(yearCookie + 1, 0, 1) };
  }

  if (status) where.status = status;
  if (type) where.documentType = type;
  if (vendor) where.vendorName = { contains: vendor, mode: "insensitive" };
  if (city) where.city = { contains: city, mode: "insensitive" };
  if (tag) where.tags = { some: { tag: { name: tag } } };
  if (reviewStatus === "ok" || reviewStatus === "nok") where.reviewStatus = reviewStatus;
  if (reviewStatus === "open") where.reviewStatus = null;

  // Date range overrides the year scope when provided.
  if (dateFrom || dateTo) {
    where.invoiceDate = {
      ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
      ...(dateTo ? { lte: new Date(dateTo) } : {}),
    };
  }
  if (amountMin || amountMax) {
    where.bruttoAmount = {
      ...(amountMin ? { gte: Number(amountMin) } : {}),
      ...(amountMax ? { lte: Number(amountMax) } : {}),
    };
  }
  if (q) {
    where.OR = [
      { vendorName: { contains: q, mode: "insensitive" } },
      { invoiceNumber: { contains: q, mode: "insensitive" } },
      { originalName: { contains: q, mode: "insensitive" } },
      { city: { contains: q, mode: "insensitive" } },
      { street: { contains: q, mode: "insensitive" } },
      { note: { contains: q, mode: "insensitive" } },
      { ocrText: { contains: q, mode: "insensitive" } },
    ];
  }

  // CSV export of the full filtered set (no pagination).
  if (format === "csv") {
    const all = await prisma.document.findMany({
      where,
      orderBy: [{ invoiceDate: { sort: "desc", nulls: "last" } }],
      include: { tags: { include: { tag: true } } },
    });
    return csvResponse(all);
  }

  const [items, total] = await Promise.all([
    prisma.document.findMany({
      where,
      orderBy: [{ invoiceDate: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { tags: { include: { tag: true } } },
    }),
    prisma.document.count({ where }),
  ]);

  return NextResponse.json({
    items: items.map(serialize),
    total,
    page,
    pageSize,
    pages: Math.ceil(total / pageSize),
  });
}

function csvResponse(docs: any[]): NextResponse {
  const header = [
    "Lieferant", "Stadt", "Rechnungsnummer", "Rechnungsdatum",
    "Netto", "MwSt", "Brutto", "Waehrung", "Typ", "Tags", "Pruefung", "Status",
  ];
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = docs.map((d) =>
    [
      d.vendorName, d.city, d.invoiceNumber,
      d.invoiceDate ? new Date(d.invoiceDate).toISOString().slice(0, 10) : "",
      d.nettoAmount ? Number(d.nettoAmount) : "",
      d.vatAmount ? Number(d.vatAmount) : "",
      d.bruttoAmount ? Number(d.bruttoAmount) : "",
      d.currency, d.documentType,
      d.tags.map((t: any) => t.tag.name).join("|"),
      d.reviewStatus ?? "offen", d.status,
    ].map(esc).join(";"),
  );
  // BOM so Excel opens UTF-8 (Umlaute) correctly; semicolons for DE locale.
  const csv = "﻿" + [header.join(";"), ...lines].join("\r\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="rechnungen-${Date.now()}.csv"`,
    },
  });
}

/** POST /api/invoices — multipart upload of one or more PDFs into the inbox. */
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  if (files.length === 0) {
    return NextResponse.json({ error: "Keine Dateien übermittelt" }, { status: 400 });
  }

  await mkdir(INGEST_DIR, { recursive: true });
  const enqueued: string[] = [];

  for (const file of files) {
    if (!file.name.toLowerCase().endsWith(".pdf")) continue;
    const bytes = Buffer.from(await file.arrayBuffer());
    const safeName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const dest = path.join(INGEST_DIR, safeName);
    await writeFile(dest, bytes);
    await enqueueIngest({ filePath: dest, originalName: file.name, source: "upload" });
    enqueued.push(file.name);
  }

  return NextResponse.json({ enqueued, count: enqueued.length });
}

function serialize(d: any) {
  return {
    ...d,
    nettoAmount: d.nettoAmount ? Number(d.nettoAmount) : null,
    vatAmount: d.vatAmount ? Number(d.vatAmount) : null,
    bruttoAmount: d.bruttoAmount ? Number(d.bruttoAmount) : null,
    tags: d.tags?.map((t: any) => ({ name: t.tag.name, color: t.tag.color, source: t.source })) ?? [],
  };
}
