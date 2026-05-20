"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Search, Filter } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge, TagChip } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { ImportPanel } from "./import-panel";
import { formatCurrency, formatDate } from "@/lib/utils";
import { DOC_TYPES, DOC_TYPE_LABEL, STATUS_LABEL, STATUS_VARIANT, STATUSES } from "@/lib/labels";

type Invoice = {
  id: string;
  vendorName: string | null;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  bruttoAmount: number | null;
  currency: string;
  documentType: string | null;
  status: string;
  confidence: number | null;
  tags: { name: string; color: string }[];
};

export function InvoicesClient() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");
  const [items, setItems] = useState<Invoice[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (status) sp.set("status", status);
    if (type) sp.set("type", type);
    const res = await fetch(`/api/invoices?${sp.toString()}`);
    const data = await res.json();
    setItems(data.items ?? []);
    setTotal(data.total ?? 0);
    setLoading(false);
  }, [q, status, type]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-end justify-between">
        <div>
          <div className="eyebrow">Belege</div>
          <h1 className="mt-1 text-[24px] font-bold tracking-tight text-ink">Rechnungen</h1>
        </div>
        <span className="text-[13px] text-mute">{total} Dokumente</span>
      </header>

      <ImportPanel onDone={load} />

      {/* Filters */}
      <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-mute" />
          <Input
            placeholder="Suche nach Lieferant, Rechnungsnr., Text…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="size-4 text-mute" />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="h-9 rounded-md border border-hairline bg-surface-card px-2 text-[14px] text-ink"
          >
            <option value="">Alle Status</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{STATUS_LABEL[s]}</option>
            ))}
          </select>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="h-9 rounded-md border border-hairline bg-surface-card px-2 text-[14px] text-ink"
          >
            <option value="">Alle Typen</option>
            {DOC_TYPES.map((t) => (
              <option key={t} value={t}>{DOC_TYPE_LABEL[t]}</option>
            ))}
          </select>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Lieferant</TableHead>
              <TableHead>Rechnungsnr.</TableHead>
              <TableHead>Datum</TableHead>
              <TableHead>Tags</TableHead>
              <TableHead className="text-right">Brutto</TableHead>
              <TableHead>Typ</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading
              ? Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={7}><Skeleton className="h-5 w-full" /></TableCell>
                  </TableRow>
                ))
              : items.map((inv) => (
                  <TableRow key={inv.id} className="cursor-pointer">
                    <TableCell className="font-medium text-ink">
                      <Link href={`/invoices/${inv.id}`} className="hover:underline">
                        {inv.vendorName ?? "—"}
                      </Link>
                    </TableCell>
                    <TableCell className="font-mono text-[13px]">{inv.invoiceNumber ?? "—"}</TableCell>
                    <TableCell>{formatDate(inv.invoiceDate)}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {inv.tags.slice(0, 3).map((t) => (
                          <TagChip key={t.name} name={t.name} color={t.color} />
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-semibold text-ink">
                      {formatCurrency(inv.bruttoAmount, inv.currency)}
                    </TableCell>
                    <TableCell>{inv.documentType ? DOC_TYPE_LABEL[inv.documentType] : "—"}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[inv.status]}>{STATUS_LABEL[inv.status]}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
            {!loading && items.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-mute">
                  Keine Rechnungen gefunden.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
