"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Check, AlertTriangle, Clock, Wallet } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { formatCurrency, formatDate } from "@/lib/utils";

export type PaymentRow = {
  id: string;
  vendorName: string | null;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  dueDate: string | null;
  paidAt: string | null;
  brutto: number;
  currency: string;
};

type Bucket = "overdue" | "open" | "paid";

function bucketOf(r: PaymentRow): Bucket {
  if (r.paidAt) return "paid";
  if (r.dueDate && new Date(r.dueDate) < new Date()) return "overdue";
  return "open";
}

export function PaymentsClient({
  rows,
  year,
  canWrite,
}: {
  rows: PaymentRow[];
  year: number;
  canWrite: boolean;
}) {
  const [data, setData] = useState(rows);
  const [tab, setTab] = useState<Bucket>("overdue");
  const [busy, setBusy] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const g: Record<Bucket, PaymentRow[]> = { overdue: [], open: [], paid: [] };
    for (const r of data) g[bucketOf(r)].push(r);
    return g;
  }, [data]);

  const sum = (rs: PaymentRow[]) => rs.reduce((s, r) => s + r.brutto, 0);

  async function togglePaid(r: PaymentRow, paid: boolean) {
    setBusy(r.id);
    const res = await fetch(`/api/invoices/${r.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paid }),
    });
    if (res.ok) {
      setData((d) => d.map((x) => (x.id === r.id ? { ...x, paidAt: paid ? new Date().toISOString() : null } : x)));
    }
    setBusy(null);
  }

  const TABS: { key: Bucket; label: string; icon: typeof Clock }[] = [
    { key: "overdue", label: "Überfällig", icon: AlertTriangle },
    { key: "open", label: "Offen", icon: Clock },
    { key: "paid", label: "Bezahlt", icon: Check },
  ];

  return (
    <div className="flex flex-col gap-6">
      <header>
        <div className="eyebrow">Zahlungen · {year}</div>
        <h1 className="mt-1 text-[24px] font-bold tracking-tight text-ink">Zahlungsübersicht</h1>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard label="Überfällig" value={sum(grouped.overdue)} currency hint={`${grouped.overdue.length} Rechnungen`} />
        <KpiCard label="Offen" value={sum(grouped.open)} currency hint={`${grouped.open.length} Rechnungen`} />
        <KpiCard label="Bezahlt" value={sum(grouped.paid)} currency hint={`${grouped.paid.length} Rechnungen`} />
      </div>

      <div className="flex items-center gap-1">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[14px] font-semibold ${
                active ? "bg-surface-card text-ink shadow-sm" : "text-body hover:bg-surface-soft"
              }`}
            >
              <Icon className="size-4" /> {t.label}
              <span className="text-mute">({grouped[t.key].length})</span>
            </button>
          );
        })}
      </div>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Lieferant</TableHead>
              <TableHead>Rechnungsnr.</TableHead>
              <TableHead>Fällig</TableHead>
              <TableHead className="text-right">Brutto</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {grouped[tab].map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium text-ink">
                  <Link href={`/invoices/${r.id}`} className="hover:underline">{r.vendorName ?? "—"}</Link>
                </TableCell>
                <TableCell className="font-mono text-[13px]">{r.invoiceNumber ?? "—"}</TableCell>
                <TableCell>
                  {r.dueDate ? (
                    <span className={bucketOf(r) === "overdue" ? "font-semibold text-accent-red" : ""}>
                      {formatDate(r.dueDate)}
                    </span>
                  ) : (
                    <span className="text-mute">—</span>
                  )}
                </TableCell>
                <TableCell className="text-right font-semibold text-ink">
                  {formatCurrency(r.brutto, r.currency)}
                </TableCell>
                <TableCell className="text-right">
                  {tab === "paid" ? (
                    <Badge variant="green"><Check className="size-3" /> bezahlt</Badge>
                  ) : canWrite ? (
                    <Button size="sm" variant="secondary" disabled={busy === r.id} onClick={() => togglePaid(r, true)}>
                      <Wallet className="size-4" /> Als bezahlt
                    </Button>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
            {grouped[tab].length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-mute">Keine Rechnungen.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
