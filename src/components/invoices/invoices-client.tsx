"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search, Download, X, Check, CircleDot } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge, TagChip } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { ImportPanel } from "./import-panel";
import { formatCurrency, formatDate } from "@/lib/utils";
import { DOC_TYPES, DOC_TYPE_LABEL, STATUS_LABEL, STATUS_VARIANT, STATUSES } from "@/lib/labels";

type Invoice = {
  id: string;
  vendorName: string | null;
  city: string | null;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  bruttoAmount: number | null;
  currency: string;
  documentType: string | null;
  status: string;
  reviewStatus: string | null;
  tags: { name: string; color: string }[];
};

type Filters = {
  q: string;
  status: string;
  type: string;
  tag: string;
  city: string;
  reviewStatus: string;
  dateFrom: string;
  dateTo: string;
  amountMin: string;
  amountMax: string;
};

const EMPTY: Filters = {
  q: "", status: "", type: "", tag: "", city: "", reviewStatus: "",
  dateFrom: "", dateTo: "", amountMin: "", amountMax: "",
};

const selectCls = "h-9 rounded-md border border-hairline bg-surface-card px-2 text-[14px] text-ink";

export function InvoicesClient({ canWrite = false }: { canWrite?: boolean }) {
  const [f, setF] = useState<Filters>(EMPTY);
  const [items, setItems] = useState<Invoice[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [opts, setOpts] = useState<{ tags: { name: string; color: string }[]; cities: string[] }>({
    tags: [],
    cities: [],
  });

  function set<K extends keyof Filters>(key: K, value: string) {
    setF((prev) => ({ ...prev, [key]: value }));
  }

  const query = useMemo(() => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(f)) if (v) sp.set(k, v);
    return sp.toString();
  }, [f]);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/invoices?${query}`);
    const data = await res.json();
    setItems(data.items ?? []);
    setTotal(data.total ?? 0);
    setLoading(false);
  }, [query]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  // Seed filters from URL (e.g. dashboard drilldown ?dateFrom=&dateTo=).
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const seed: Partial<Filters> = {};
    (Object.keys(EMPTY) as (keyof Filters)[]).forEach((k) => {
      const v = sp.get(k);
      if (v) seed[k] = v;
    });
    if (Object.keys(seed).length) setF((prev) => ({ ...prev, ...seed }));
  }, []);

  useEffect(() => {
    fetch("/api/meta/filters")
      .then((r) => r.json())
      .then((d) => setOpts({ tags: d.tags ?? [], cities: d.cities ?? [] }))
      .catch(() => {});
  }, []);

  const hasFilters = Object.values(f).some(Boolean);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-end justify-between">
        <div>
          <div className="eyebrow">Belege</div>
          <h1 className="mt-1 text-[24px] font-bold tracking-tight text-ink">Rechnungen</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[13px] text-mute">{total} Dokumente</span>
          <a href={`/api/invoices?${query}&format=csv`}>
            <Button variant="secondary" size="sm">
              <Download className="size-4" /> CSV
            </Button>
          </a>
          <a href="/api/export/zip">
            <Button variant="secondary" size="sm">
              <Download className="size-4" /> ZIP (Jahr)
            </Button>
          </a>
        </div>
      </header>

      {canWrite && <ImportPanel onDone={load} />}

      {/* Filter bar */}
      <Card className="flex flex-col gap-3 p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-mute" />
          <Input
            placeholder="Volltextsuche: Inhalt (OCR), Lieferant, Stadt, Straße, Rechnungsnr., Notiz…"
            value={f.q}
            onChange={(e) => set("q", e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select value={f.status} onChange={(e) => set("status", e.target.value)} className={selectCls}>
            <option value="">Alle Status</option>
            {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
          <select value={f.type} onChange={(e) => set("type", e.target.value)} className={selectCls}>
            <option value="">Alle Typen</option>
            {DOC_TYPES.map((t) => <option key={t} value={t}>{DOC_TYPE_LABEL[t]}</option>)}
          </select>
          <select value={f.reviewStatus} onChange={(e) => set("reviewStatus", e.target.value)} className={selectCls}>
            <option value="">Prüfung: alle</option>
            <option value="ok">OK</option>
            <option value="nok">Nicht OK</option>
            <option value="open">offen</option>
          </select>
          <select value={f.tag} onChange={(e) => set("tag", e.target.value)} className={selectCls}>
            <option value="">Alle Tags</option>
            {opts.tags.map((t) => <option key={t.name} value={t.name}>{t.name}</option>)}
          </select>
          <select value={f.city} onChange={(e) => set("city", e.target.value)} className={selectCls}>
            <option value="">Alle Städte</option>
            {opts.cities.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>

          <div className="flex items-center gap-1 text-[13px] text-mute">
            <span>Datum</span>
            <input type="date" value={f.dateFrom} onChange={(e) => set("dateFrom", e.target.value)} className={selectCls} />
            <span>–</span>
            <input type="date" value={f.dateTo} onChange={(e) => set("dateTo", e.target.value)} className={selectCls} />
          </div>
          <div className="flex items-center gap-1 text-[13px] text-mute">
            <span>Brutto €</span>
            <Input type="number" placeholder="min" value={f.amountMin} onChange={(e) => set("amountMin", e.target.value)} className="h-9 w-20" />
            <Input type="number" placeholder="max" value={f.amountMax} onChange={(e) => set("amountMax", e.target.value)} className="h-9 w-20" />
          </div>

          {hasFilters && (
            <Button variant="tertiary" size="sm" onClick={() => setF(EMPTY)}>
              <X className="size-4" /> Zurücksetzen
            </Button>
          )}
        </div>
      </Card>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-12"></TableHead>
              <TableHead>Lieferant</TableHead>
              <TableHead>Stadt</TableHead>
              <TableHead>Rechnungsnr.</TableHead>
              <TableHead>Datum</TableHead>
              <TableHead>Tags</TableHead>
              <TableHead className="text-right">Brutto</TableHead>
              <TableHead>Prüfung</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading
              ? Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={9}><Skeleton className="h-5 w-full" /></TableCell>
                  </TableRow>
                ))
              : items.map((inv) => (
                  <TableRow key={inv.id} className="cursor-pointer">
                    <TableCell>
                      <Link href={`/invoices/${inv.id}`}>
                        <img
                          src={`/api/invoices/${inv.id}/thumb`}
                          alt=""
                          loading="lazy"
                          className="h-10 w-8 rounded-sm border border-hairline-soft bg-surface-soft object-cover"
                          onError={(e) => ((e.target as HTMLImageElement).style.visibility = "hidden")}
                        />
                      </Link>
                    </TableCell>
                    <TableCell className="font-medium text-ink">
                      <Link href={`/invoices/${inv.id}`} className="hover:underline">
                        {inv.vendorName ?? "—"}
                      </Link>
                    </TableCell>
                    <TableCell>{inv.city ?? "—"}</TableCell>
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
                    <TableCell><ReviewBadge status={inv.reviewStatus} /></TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[inv.status]}>{STATUS_LABEL[inv.status]}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
            {!loading && items.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="py-10 text-center text-mute">
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

function ReviewBadge({ status }: { status: string | null }) {
  if (status === "ok") return <Badge variant="green"><Check className="size-3" /> OK</Badge>;
  if (status === "nok") return <Badge variant="red"><X className="size-3" /> Nicht OK</Badge>;
  return <Badge variant="neutral"><CircleDot className="size-3" /> offen</Badge>;
}
