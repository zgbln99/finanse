"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { formatCurrency, formatDate } from "@/lib/utils";

type Vendor = {
  vendor: string;
  brutto: number;
  netto: number;
  count: number;
  lastInvoice: string | null;
};

export function VendorsClient({ year }: { year: number }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/vendors?q=${encodeURIComponent(q)}`);
    const data = await res.json();
    setVendors(data.vendors ?? []);
    setTotal(data.total ?? 0);
    setLoading(false);
  }, [q]);

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-end justify-between">
        <div>
          <div className="eyebrow">Übersicht · {year}</div>
          <h1 className="mt-1 text-[24px] font-bold tracking-tight text-ink">Lieferanten</h1>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard label={`Kosten ${year}`} value={total} currency />
        <KpiCard label="Lieferanten" value={vendors.length} hint={q ? "gefiltert" : "gesamt"} />
        <KpiCard
          label="Ø pro Lieferant"
          value={vendors.length ? Math.round((total / vendors.length) * 100) / 100 : 0}
          currency
        />
      </div>

      <Card className="p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-mute" />
          <Input
            placeholder="Lieferant suchen…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9"
          />
        </div>
      </Card>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Lieferant</TableHead>
              <TableHead className="text-right">Rechnungen</TableHead>
              <TableHead>Letzte</TableHead>
              <TableHead className="text-right">Netto</TableHead>
              <TableHead className="text-right">Brutto (gesamt)</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading
              ? Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i}><TableCell colSpan={6}><Skeleton className="h-5 w-full" /></TableCell></TableRow>
                ))
              : vendors.map((v) => (
                  <TableRow
                    key={v.vendor}
                    className="cursor-pointer"
                    onClick={() => router.push(`/invoices?vendor=${encodeURIComponent(v.vendor)}`)}
                  >
                    <TableCell className="font-medium text-ink">{v.vendor}</TableCell>
                    <TableCell className="text-right">{v.count}</TableCell>
                    <TableCell>{formatDate(v.lastInvoice)}</TableCell>
                    <TableCell className="text-right text-body">{formatCurrency(v.netto)}</TableCell>
                    <TableCell className="text-right font-bold text-ink">{formatCurrency(v.brutto)}</TableCell>
                    <TableCell><ChevronRight className="size-4 text-mute" /></TableCell>
                  </TableRow>
                ))}
            {!loading && vendors.length === 0 && (
              <TableRow><TableCell colSpan={6} className="py-10 text-center text-mute">Keine Lieferanten.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
