"use client";

import { useRef, useState } from "react";
import { MousePointerSquareDashed, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";

type Rect = { x: number; y: number; w: number; h: number };
type Target = "nettoAmount" | "vatAmount" | "bruttoAmount";

const TARGETS: { value: Target; label: string }[] = [
  { value: "nettoAmount", label: "Netto" },
  { value: "vatAmount", label: "MwSt" },
  { value: "bruttoAmount", label: "Brutto" },
];

export function RegionPicker({
  documentId,
  pageCount = 1,
  onApply,
}: {
  documentId: string;
  pageCount?: number;
  onApply: (field: Target, value: number) => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ sx: number; sy: number } | null>(null);
  const [rect, setRect] = useState<Rect | null>(null);
  const [target, setTarget] = useState<Target>("bruttoAmount");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ raw: string; amount: number | null } | null>(null);
  const [page, setPage] = useState(1);
  const total = Math.max(1, pageCount);

  function goPage(p: number) {
    const next = Math.min(total, Math.max(1, p));
    setPage(next);
    setRect(null);
    setResult(null);
  }

  function rel(e: React.MouseEvent) {
    const b = boxRef.current!.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (e.clientX - b.left) / b.width)),
      y: Math.min(1, Math.max(0, (e.clientY - b.top) / b.height)),
    };
  }

  function onDown(e: React.MouseEvent) {
    const p = rel(e);
    setDrag({ sx: p.x, sy: p.y });
    setRect({ x: p.x, y: p.y, w: 0, h: 0 });
    setResult(null);
  }
  function onMove(e: React.MouseEvent) {
    if (!drag) return;
    const p = rel(e);
    setRect({
      x: Math.min(drag.sx, p.x),
      y: Math.min(drag.sy, p.y),
      w: Math.abs(p.x - drag.sx),
      h: Math.abs(p.y - drag.sy),
    });
  }
  function onUp() {
    setDrag(null);
  }

  async function read() {
    if (!rect || rect.w < 0.01 || rect.h < 0.01) return;
    setBusy(true);
    setResult(null);
    const res = await fetch(`/api/invoices/${documentId}/ocr-region`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...rect, page }),
    });
    const data = await res.json();
    setBusy(false);
    if (res.ok) {
      setResult(data);
      if (typeof data.amount === "number") onApply(target, data.amount);
    } else {
      setResult({ raw: data.error ?? "Fehler", amount: null });
    }
  }

  return (
    <div className="flex flex-col gap-3 p-3">
      <p className="flex items-center gap-2 text-[13px] text-mute">
        <MousePointerSquareDashed className="size-4" />
        Ziehe ein Rechteck über den Betrag, wähle das Zielfeld und klicke „Auslesen".
      </p>

      {/* Page navigation for multi-page invoices */}
      <div className="flex items-center justify-center gap-2">
        <Button size="sm" variant="secondary" onClick={() => goPage(page - 1)} disabled={page <= 1}>
          <ChevronLeft className="size-4" />
        </Button>
        <span className="text-[13px] font-medium text-ink">
          Seite
          <input
            type="number"
            min={1}
            max={total}
            value={page}
            onChange={(e) => goPage(Number(e.target.value))}
            className="mx-2 w-14 rounded-md border border-hairline bg-surface-card px-2 py-1 text-center"
          />
          / {total}
        </span>
        <Button size="sm" variant="secondary" onClick={() => goPage(page + 1)} disabled={page >= total}>
          <ChevronRight className="size-4" />
        </Button>
      </div>

      <div
        ref={boxRef}
        className="relative w-full cursor-crosshair select-none overflow-hidden rounded-md border border-hairline bg-surface-soft"
        onMouseDown={onDown}
        onMouseMove={onMove}
        onMouseUp={onUp}
        onMouseLeave={onUp}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={page}
          src={`/api/invoices/${documentId}/page/${page}`}
          alt={`Rechnung Seite ${page}`}
          className="pointer-events-none w-full"
          draggable={false}
        />
        {rect && (
          <div
            className="pointer-events-none absolute border-2 border-accent-blue bg-accent-blue/15"
            style={{
              left: `${rect.x * 100}%`,
              top: `${rect.y * 100}%`,
              width: `${rect.w * 100}%`,
              height: `${rect.h * 100}%`,
            }}
          />
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[13px] text-mute">Zielfeld:</span>
        {TARGETS.map((t) => (
          <button
            key={t.value}
            onClick={() => setTarget(t.value)}
            className={`rounded-md px-3 py-1.5 text-[13px] font-semibold ${
              target === t.value ? "bg-ink text-on-dark" : "border border-hairline bg-surface-card text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
        <Button size="sm" onClick={read} disabled={busy || !rect || rect.w < 0.01}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <MousePointerSquareDashed className="size-4" />}
          Auslesen
        </Button>
      </div>

      {result && (
        <div className="rounded-md border border-hairline-soft bg-surface-doc px-3 py-2 text-[13px]">
          <div className="text-mute">Erkannter Text: <span className="font-mono text-ink">{result.raw || "—"}</span></div>
          <div className="mt-0.5">
            {result.amount != null ? (
              <span className="font-semibold text-accent-green">
                → {formatCurrency(result.amount)} in {TARGETS.find((t) => t.value === target)?.label} übernommen. Nicht vergessen: Speichern.
              </span>
            ) : (
              <span className="text-accent-red">Keine Zahl erkannt — Auswahl enger ziehen.</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
