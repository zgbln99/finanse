"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, CheckCircle2, Circle, ExternalLink, CalendarRange } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge, TagChip } from "@/components/ui/badge";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { DOC_TYPE_LABEL, STATUS_LABEL, STATUS_VARIANT } from "@/lib/labels";
import type { KwGroup, KwInvoice, KwOverview } from "@/lib/kw";

export function KwClient({
  overview,
  gf1Name,
  gf2Name,
}: {
  overview: KwOverview;
  gf1Name: string;
  gf2Name: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState<number | null>(overview.groups[0]?.week ?? null);

  const fullyApproved = overview.totalCount - overview.openCount;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="eyebrow">Geschäftsführungs-Freigabe</div>
          <h1 className="mt-1 text-[24px] font-bold tracking-tight text-ink">KW-Kontrolle</h1>
          <p className="mt-1 text-[14px] text-mute">
            Eingangsrechnungen je Kalenderwoche prüfen. Freigabe durch {gf1Name} und {gf2Name}.
          </p>
        </div>
        <label className="flex items-center gap-2 text-[14px] text-body">
          <CalendarRange className="size-4 text-mute" /> Jahr
          <select
            value={overview.year}
            onChange={(e) => router.push(`/kw?year=${e.target.value}`)}
            className="h-9 rounded-md border border-hairline bg-surface-card px-2 text-[14px] text-ink"
          >
            {overview.years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </label>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard label={`Gesamtkosten ${overview.year}`} value={overview.totalBrutto} currency />
        <KpiCard label="Rechnungen gesamt" value={overview.totalCount} hint={`${overview.groups.length} Kalenderwochen`} />
        <KpiCard
          label="Freigabe-Status"
          value={`${fullyApproved} / ${overview.totalCount}`}
          hint={overview.openCount > 0 ? `${overview.openCount} offen` : "alle freigegeben"}
        />
      </div>

      <div className="flex flex-col gap-3">
        {overview.groups.map((g) => (
          <KwAccordion
            key={g.week}
            group={g}
            open={open === g.week}
            onToggle={() => setOpen(open === g.week ? null : g.week)}
            gf1Name={gf1Name}
            gf2Name={gf2Name}
          />
        ))}
        {overview.groups.length === 0 && (
          <Card className="p-10 text-center text-mute">
            Keine Rechnungen für {overview.year}. Importiere PDFs unter „Rechnungen“.
          </Card>
        )}
      </div>
    </div>
  );
}

function KwAccordion({
  group,
  open,
  onToggle,
  gf1Name,
  gf2Name,
}: {
  group: KwGroup;
  open: boolean;
  onToggle: () => void;
  gf1Name: string;
  gf2Name: string;
}) {
  const allApproved = group.approvedCount === group.count;
  return (
    <Card className="overflow-hidden">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left hover:bg-surface-soft/50"
      >
        <div className="flex items-center gap-3">
          <ChevronDown className={cn("size-5 text-mute transition-transform", open && "rotate-180")} />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[16px] font-bold text-ink">{group.label}</span>
              <span className="text-[13px] text-mute">{group.range}</span>
            </div>
            <div className="text-[12px] text-mute">{group.count} Rechnungen</div>
          </div>
        </div>
        <div className="flex items-center gap-5">
          <div className="text-right">
            <div className="text-[12px] uppercase tracking-wide text-mute">Kosten KW</div>
            <div className="text-[18px] font-bold text-ink">{formatCurrency(group.brutto)}</div>
          </div>
          <Badge variant={allApproved ? "green" : "purple"}>
            {allApproved ? <CheckCircle2 className="size-3.5" /> : <Circle className="size-3.5" />}
            {group.approvedCount}/{group.count} freigegeben
          </Badge>
        </div>
      </button>

      {open && (
        <div className="border-t border-hairline-soft">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Lieferant</TableHead>
                <TableHead>Datum</TableHead>
                <TableHead className="text-right">Netto</TableHead>
                <TableHead className="text-right">Brutto</TableHead>
                <TableHead className="text-center">{gf1Name}</TableHead>
                <TableHead className="text-center">{gf2Name}</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {group.invoices.map((inv) => (
                <InvoiceRow key={inv.id} invoice={inv} />
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </Card>
  );
}

function InvoiceRow({ invoice }: { invoice: KwInvoice }) {
  const [gf1, setGf1] = useState(Boolean(invoice.gf1ApprovedAt));
  const [gf2, setGf2] = useState(Boolean(invoice.gf2ApprovedAt));
  const [busy, setBusy] = useState(false);

  async function toggle(slot: 1 | 2) {
    if (busy) return;
    setBusy(true);
    const approve = slot === 1 ? !gf1 : !gf2;
    const res = await fetch(`/api/invoices/${invoice.id}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slot, approve }),
    });
    if (res.ok) {
      if (slot === 1) setGf1(approve);
      else setGf2(approve);
    }
    setBusy(false);
  }

  const fully = gf1 && gf2;

  return (
    <TableRow className={cn(fully && "bg-accent-green-soft/30")}>
      <TableCell>
        <div className="font-medium text-ink">{invoice.vendorName ?? "Unbekannt"}</div>
        <div className="flex flex-wrap items-center gap-1.5 text-[12px] text-mute">
          <span className="font-mono">{invoice.invoiceNumber ?? "—"}</span>
          {invoice.documentType && <span>· {DOC_TYPE_LABEL[invoice.documentType]}</span>}
          {invoice.status === "needs_review" && (
            <Badge variant={STATUS_VARIANT[invoice.status]}>{STATUS_LABEL[invoice.status]}</Badge>
          )}
          {invoice.tags.slice(0, 2).map((t) => (
            <TagChip key={t.name} name={t.name} color={t.color} />
          ))}
        </div>
      </TableCell>
      <TableCell>{formatDate(invoice.invoiceDate)}</TableCell>
      <TableCell className="text-right">{formatCurrency(invoice.netto, invoice.currency)}</TableCell>
      <TableCell className="text-right font-semibold text-ink">
        {formatCurrency(invoice.brutto, invoice.currency)}
      </TableCell>
      <TableCell className="text-center">
        <ApproveButton checked={gf1} busy={busy} onClick={() => toggle(1)} />
      </TableCell>
      <TableCell className="text-center">
        <ApproveButton checked={gf2} busy={busy} onClick={() => toggle(2)} />
      </TableCell>
      <TableCell>
        <Link href={`/invoices/${invoice.id}`} className="text-mute hover:text-ink" title="Details">
          <ExternalLink className="size-4" />
        </Link>
      </TableCell>
    </TableRow>
  );
}

function ApproveButton({ checked, busy, onClick }: { checked: boolean; busy: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className={cn(
        "inline-flex size-7 items-center justify-center rounded-full border transition-colors disabled:opacity-50",
        checked
          ? "border-accent-green bg-accent-green text-white"
          : "border-hairline bg-surface-card text-stone hover:border-accent-green",
      )}
      title={checked ? "Freigabe zurückziehen" : "Freigeben"}
    >
      <CheckCircle2 className="size-4" />
    </button>
  );
}
