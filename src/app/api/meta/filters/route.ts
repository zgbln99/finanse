import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Distinct values that power the invoice filter dropdowns. */
export async function GET() {
  const [tags, vendors, cities] = await Promise.all([
    prisma.tag.findMany({ orderBy: { name: "asc" }, select: { name: true, color: true } }),
    prisma.document.findMany({
      where: { vendorName: { not: null } },
      distinct: ["vendorName"],
      select: { vendorName: true },
      orderBy: { vendorName: "asc" },
    }),
    prisma.document.findMany({
      where: { city: { not: null } },
      distinct: ["city"],
      select: { city: true },
      orderBy: { city: "asc" },
    }),
  ]);

  return NextResponse.json({
    tags,
    vendors: vendors.map((v) => v.vendorName).filter(Boolean),
    cities: cities.map((c) => c.city).filter(Boolean),
  });
}
