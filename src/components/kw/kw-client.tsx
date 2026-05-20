"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  CircleDot,
} from "lucide-react";
import { Badge, TagChip } from "@/components/ui/badge";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { DOC_TYPE_LABEL } from "@/lib/labels";
import type { KwInvoice, KwOverview } from "@/lib/kw";

type Edit = { reviewStatus: string | null; note: string };

export function KwClient({ overview }: { overview: KwOverview; gf1Name?: string; gf2Name?: string }) {
  // Local verdict/note overrides so the UI updates instantly.
  const [edits, setEdits] = useState<Record<string, Edit>>(() => {
    const m: Record<string, Edit> = {};
    for (const g of overview.groups)
      for (const inv of g.invoices) m[inv.id] = { reviewStatus: inv.reviewStatus, note: inv.note ?? "" };
    return m;
  });

  // Flat, ordered list of all invoices (slideshow order).
  const flat = useMemo(() => overview.groups.flatMap((g) => g.invoices), [overview.groups]);
  const [selectedId, setSelectedId] = useState<string | null>(flat[0]?.id ?? null);
  const selected = flat.find((i) => i.id === selectedId) ?? null;
  const selectedIdx = flat.findIndex((i) => i.id === selectedId);

  const counts = useMemo(() => {
    let ok = 0, nok = 0, open = 0;
    for (const inv of flat) {
      const s = edits[inv.id]?.reviewStatus;
      if (s === "ok") ok++;
      else if (s === "nok") nok++;
      else open++;
    }
    return { ok, nok, open };
  }, [edits, flat]);

  async function persist(id: string, next: Edit) {
    setEdits((e) => ({ ...e, [id]: next }));
    await fetch(`/api/invoices/${id}/kw-status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next.reviewStatus, note: next.note || null }),
    });
  }

  function setVerdict(id: string, status: "ok" | "nok") {
    const cur = edits[id] ?? { reviewStatus: null, note: "" };
    const reviewStatus = cur.reviewStatus === status ? null : status; // toggle off
    persist(id, { ...cur, reviewStatus });
  }

  function go(delta: number) {
    const next = flat[selectedIdx + delta];
    if (next) setSelectedId(next.id);
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="eyebrow">Rechnungsprüfung · {overview.year}</div>
          <h1 className="mt-1 text-[24px] font-bold tracking-tight text-ink">KW-Kontrolle</h1>
        </div>
        <div className="flex items-center gap-2 text-[13px]">
          <Badge variant="green">{counts.ok} OK</Badge>
          <Badge variant="red">{counts.nok} Nicht OK</Badge>
          <Badge variant="neutral">{counts.open} offen</Badge>
          <span className="ml-2 font-semibold text-ink">{formatCurrency(overview.totalBrutto)}</span>
        </div>
      </header>

      <div className="flex flex-col gap-4 lg:h-[calc(100vh-12rem)] lg:flex-row">
        {/* Big preview + verdict controls */}
        <section className="order-2 flex min-h-0 flex-1 flex-col rounded-md border border-hairline bg-surface-card lg:order-1">
          {selected ? (
            <PreviewPane
              key={selected.id}
              invoice={selected}
              edit={edits[selected.id]}
              index={selectedIdx}
              total={flat.length}
              onVerdict={(s) => setVerdict(selected.id, s)}
              onNote={(note) => persist(selected.id, { ...(edits[selected.id] ?? { reviewStatus: null, note: "" }), note })}
              onPrev={() => go(-1)}
              onNext={() => go(1)}
            />
          ) : (
            <div className="flex flex-1 items-center justify-center p-10 text-mute">
              Keine Rechnungen für {overview.year}.
            </div>
          )}
        </section>

        {/* Right list grouped by KW */}
        <aside className="order-1 flex w-full shrink-0 flex-col overflow-hidden rounded-md border border-hairline bg-surface-card lg:order-2 lg:w-[360px]">
          <div className="border-b border-hairline-soft px-4 py-3 text-[13px] font-semibold text-ink">
            Kalenderwochen
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {overview.groups.map((g) => {
              const live = g.invoices.reduce(
                (acc, inv) => {
                  const s = edits[inv.id]?.reviewStatus;
                  if (s === "ok") acc.ok++;
                  else if (s === "nok") acc.nok++;
                  return acc;
                },
                { ok: 0, nok: 0 },
              );
              return (
                <div key={g.week}>
                  <div className="sticky top-0 flex items-center justify-between bg-surface-soft px-4 py-2">
                    <div>
                      <span className="text-[13px] font-bold text-ink">{g.label}</span>
                      <span className="ml-2 text-[11px] text-mute">{g.range}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[12px]">
                      <span className="font-semibold text-ink">{formatCurrency(g.brutto)}</span>
                      <span className="text-mute">
                        {live.ok}/{g.count}
                      </span>
                    </div>
                  </div>
                  {g.invoices.map((inv) => (
                    <ListRow
                      key={inv.id}
                      invoice={inv}
                      status={edits[inv.id]?.reviewStatus ?? null}
                      active={inv.id === selectedId}
                      onClick={() => setSelectedId(inv.id)}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        </aside>
      </div>
    </div>
  );
}

function StatusDot({ status }: { status: string | null }) {
  if (status === "ok") return <span className="size-2.5 rounded-full bg-accent-green" title="OK" />;
  if (status === "nok") return <span className="size-2.5 rounded-full bg-accent-red" title="Nicht OK" />;
  return <span className="size-2.5 rounded-full border border-stone" title="offen" />;
}

function ListRow({
  invoice,
  status,
  active,
  onClick,
}: {
  invoice: KwInvoice;
  status: string | null;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 border-b border-hairline-soft px-4 py-2.5 text-left hover:bg-surface-soft",
        active && "bg-accent-blue-soft/40",
      )}
    >
      <StatusDot status={status} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-medium text-ink">{invoice.vendorName ?? "Unbekannt"}</div>
        <div className="truncate text-[11px] text-mute">{invoice.invoiceNumber ?? invoice.id.slice(-6)}</div>
      </div>
      <div className="text-right text-[13px] font-semibold text-ink">
        {formatCurrency(invoice.brutto, invoice.currency)}
      </div>
    </button>
  );
}

function PreviewPane({
  invoice,
  edit,
  index,
  total,
  onVerdict,
  onNote,
  onPrev,
  onNext,
}: {
  invoice: KwInvoice;
  edit?: Edit;
  index: number;
  total: number;
  onVerdict: (s: "ok" | "nok") => void;
  onNote: (note: string) => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const [note, setNote] = useState(edit?.note ?? "");
  const status = edit?.reviewStatus ?? null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Top control bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline-soft p-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate text-[16px] font-bold text-ink">{invoice.vendorName ?? "Unbekannt"}</span>
            <Link href={`/invoices/${invoice.id}`} className="text-mute hover:text-ink" title="Details öffnen">
              <ExternalLink className="size-4" />
            </Link>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-[12px] text-mute">
            <span className="font-mono">{invoice.invoiceNumber ?? "—"}</span>
            <span>· {formatDate(invoice.invoiceDate)}</span>
            {invoice.documentType && <span>· {DOC_TYPE_LABEL[invoice.documentType]}</span>}
            {invoice.tags.slice(0, 3).map((t) => (
              <TagChip key={t.name} name={t.name} color={t.color} />
            ))}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[11px] uppercase tracking-wide text-mute">Brutto</div>
          <div className="text-[20px] font-bold text-ink">{formatCurrency(invoice.brutto, invoice.currency)}</div>
        </div>
      </div>

      {/* PDF */}
      <div className="relative min-h-0 flex-1 bg-surface-soft">
        <iframe src={`/api/invoices/${invoice.id}/file`} className="h-full min-h-[420px] w-full" title="Rechnung PDF" />
      </div>

      {/* Verdict + uwagi */}
      <div className="flex flex-col gap-3 border-t border-hairline-soft p-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => onVerdict("ok")}
            className={cn(
              "inline-flex h-10 items-center gap-2 rounded-md px-5 text-[14px] font-bold transition-colors",
              status === "ok"
                ? "bg-accent-green text-white"
                : "border border-hairline bg-surface-card text-ink hover:border-accent-green",
            )}
          >
            <Check className="size-4" /> OK
          </button>
          <button
            onClick={() => onVerdict("nok")}
            className={cn(
              "inline-flex h-10 items-center gap-2 rounded-md px-5 text-[14px] font-bold transition-colors",
              status === "nok"
                ? "bg-accent-red text-white"
                : "border border-hairline bg-surface-card text-ink hover:border-accent-red",
            )}
          >
            <X className="size-4" /> Nicht OK
          </button>
          {status === null && (
            <span className="inline-flex items-center gap-1 text-[13px] text-mute">
              <CircleDot className="size-4" /> noch nicht geprüft
            </span>
          )}

          <div className="ml-auto flex items-center gap-1">
            <button
              onClick={onPrev}
              disabled={index <= 0}
              className="inline-flex size-9 items-center justify-center rounded-md border border-hairline bg-surface-card text-ink disabled:opacity-40 hover:bg-surface-soft"
              title="Vorherige"
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="px-1 text-[12px] text-mute">
              {index + 1} / {total}
            </span>
            <button
              onClick={onNext}
              disabled={index >= total - 1}
              className="inline-flex size-9 items-center justify-center rounded-md border border-hairline bg-surface-card text-ink disabled:opacity-40 hover:bg-surface-soft"
              title="Nächste"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>

        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => onNote(note)}
          rows={2}
          placeholder="Uwagi / Anmerkung zur Rechnung… (wird beim Verlassen des Feldes gespeichert)"
          className="w-full rounded-md border border-hairline bg-surface-card p-2.5 text-[14px] text-ink placeholder:text-ash focus:border-accent-blue focus:outline-none focus:ring-2 focus:ring-accent-blue/40"
        />
      </div>
    </div>
  );
}
