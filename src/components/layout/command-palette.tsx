"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2 } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";

type Hit = {
  id: string;
  vendorName: string | null;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  bruttoAmount: number | null;
  currency: string;
};

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Global ⌘K / Ctrl+K toggle.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 30);
    else {
      setQ("");
      setHits([]);
      setActive(0);
    }
  }, [open]);

  const search = useCallback(async (term: string) => {
    if (!term.trim()) {
      setHits([]);
      return;
    }
    setLoading(true);
    const res = await fetch(`/api/invoices?q=${encodeURIComponent(term)}&pageSize=8`);
    const data = await res.json();
    setHits(data.items ?? []);
    setActive(0);
    setLoading(false);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => search(q), 200);
    return () => clearTimeout(t);
  }, [q, search]);

  function go(hit: Hit) {
    setOpen(false);
    router.push(`/invoices/${hit.id}`);
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-ink/30 px-4 pt-[12vh]"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-lg border border-hairline bg-surface-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-hairline-soft px-4">
          <Search className="size-4 text-mute" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") setActive((a) => Math.min(a + 1, hits.length - 1));
              if (e.key === "ArrowUp") setActive((a) => Math.max(a - 1, 0));
              if (e.key === "Enter" && hits[active]) go(hits[active]);
            }}
            placeholder="Rechnung suchen — Lieferant, Nummer, Inhalt…"
            className="h-12 w-full bg-transparent text-[15px] text-ink placeholder:text-ash focus:outline-none"
          />
          {loading && <Loader2 className="size-4 animate-spin text-mute" />}
        </div>
        <div className="max-h-[50vh] overflow-y-auto">
          {hits.map((h, i) => (
            <button
              key={h.id}
              onClick={() => go(h)}
              onMouseEnter={() => setActive(i)}
              className={`flex w-full items-center gap-3 px-4 py-2.5 text-left ${
                i === active ? "bg-surface-soft" : ""
              }`}
            >
              <img
                src={`/api/invoices/${h.id}/thumb`}
                alt=""
                className="h-10 w-8 shrink-0 rounded-sm border border-hairline-soft object-cover"
                onError={(e) => ((e.target as HTMLImageElement).style.visibility = "hidden")}
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-medium text-ink">{h.vendorName ?? "Unbekannt"}</div>
                <div className="truncate text-[12px] text-mute">
                  {h.invoiceNumber ?? "—"} · {formatDate(h.invoiceDate)}
                </div>
              </div>
              <div className="text-[13px] font-semibold text-ink">{formatCurrency(h.bruttoAmount, h.currency)}</div>
            </button>
          ))}
          {q && !loading && hits.length === 0 && (
            <div className="px-4 py-6 text-center text-[13px] text-mute">Keine Treffer.</div>
          )}
          {!q && (
            <div className="px-4 py-6 text-center text-[13px] text-mute">
              Tippe zum Suchen · <kbd className="rounded bg-surface-soft px-1.5 py-0.5">Esc</kbd> schließt
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
