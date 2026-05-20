"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, FileText, ScanText, Save, History, Sparkles, Link2, Copy, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, TagChip } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/utils";
import { DOC_TYPES, DOC_TYPE_LABEL, STATUS_LABEL, STATUS_VARIANT } from "@/lib/labels";

type Detail = any;

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[12px] font-semibold uppercase tracking-wide text-mute">{label}</span>
      {children}
    </label>
  );
}

export function InvoiceDetail({ initial }: { initial: Detail }) {
  const [doc, setDoc] = useState<Detail>(initial);
  const [tab, setTab] = useState<"pdf" | "ocr">("pdf");
  const [saving, setSaving] = useState(false);
  const [tagInput, setTagInput] = useState<string>(
    (doc.tags ?? []).map((t: any) => t.name).join(", "),
  );

  function set<K extends string>(key: K, value: unknown) {
    setDoc((d: Detail) => ({ ...d, [key]: value }));
  }

  async function save(markReviewed = false) {
    setSaving(true);
    const payload = {
      vendorName: doc.vendorName,
      city: doc.city,
      street: doc.street,
      postalCode: doc.postalCode,
      country: doc.country,
      invoiceNumber: doc.invoiceNumber,
      invoiceDate: doc.invoiceDate ? new Date(doc.invoiceDate).toISOString() : null,
      nettoAmount: numOrNull(doc.nettoAmount),
      vatAmount: numOrNull(doc.vatAmount),
      bruttoAmount: numOrNull(doc.bruttoAmount),
      currency: doc.currency,
      documentType: doc.documentType,
      isRecurring: doc.isRecurring,
      note: doc.note ?? null,
      tags: tagInput.split(",").map((t) => t.trim()).filter(Boolean),
      reviewed: markReviewed,
    };
    const res = await fetch(`/api/invoices/${doc.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) setDoc(await res.json());
    setSaving(false);
  }

  const [shareUrl, setShareUrl] = useState<string | null>(
    doc.shareToken ? `${origin()}/share/${doc.shareToken}` : null,
  );
  const [copied, setCopied] = useState(false);

  async function createShare() {
    const res = await fetch(`/api/invoices/${doc.id}/share`, { method: "POST" });
    if (res.ok) {
      const { token } = await res.json();
      setDoc((d: Detail) => ({ ...d, shareToken: token }));
      setShareUrl(`${origin()}/share/${token}`);
    }
  }

  async function revokeShare() {
    const res = await fetch(`/api/invoices/${doc.id}/share`, { method: "DELETE" });
    if (res.ok) {
      setDoc((d: Detail) => ({ ...d, shareToken: null }));
      setShareUrl(null);
    }
  }

  function copyLink() {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const confidencePct = doc.confidence != null ? Math.round(doc.confidence * 100) : null;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/invoices">
            <Button variant="tertiary" size="icon"><ArrowLeft className="size-4" /></Button>
          </Link>
          <div>
            <h1 className="text-[20px] font-bold text-ink">{doc.vendorName ?? "Unbekannter Lieferant"}</h1>
            <div className="flex items-center gap-2 text-[13px] text-mute">
              <span className="font-mono">{doc.invoiceNumber ?? "—"}</span>
              <span>·</span>
              <span>{doc.originalName}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={STATUS_VARIANT[doc.status]}>{STATUS_LABEL[doc.status]}</Badge>
          {confidencePct != null && (
            <Badge variant={confidencePct >= 80 ? "green" : "purple"}>
              <Sparkles className="size-3" /> {confidencePct}% Konfidenz
            </Badge>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Preview */}
        <Card className="overflow-hidden">
          <div className="flex items-center gap-1 border-b border-hairline-soft p-2">
            <Button variant={tab === "pdf" ? "secondary" : "tertiary"} size="sm" onClick={() => setTab("pdf")}>
              <FileText className="size-4" /> PDF
            </Button>
            <Button variant={tab === "ocr" ? "secondary" : "tertiary"} size="sm" onClick={() => setTab("ocr")}>
              <ScanText className="size-4" /> OCR-Text
            </Button>
          </div>
          <CardContent className="p-0">
            {tab === "pdf" ? (
              <iframe
                src={`/api/invoices/${doc.id}/file`}
                className="h-[600px] w-full bg-surface-soft"
                title="PDF Vorschau"
              />
            ) : (
              <pre className="h-[600px] overflow-auto whitespace-pre-wrap p-4 font-mono text-[12px] leading-relaxed text-body">
                {doc.ocrText || "Kein OCR-Text vorhanden."}
              </pre>
            )}
          </CardContent>
        </Card>

        {/* Editor */}
        <Card>
          <CardHeader>
            <CardTitle>AI-Metadaten · Prüfung & Korrektur</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Field label="Lieferant (Kreditor)">
              <Input value={doc.vendorName ?? ""} onChange={(e) => set("vendorName", e.target.value)} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Rechnungsnummer">
                <Input value={doc.invoiceNumber ?? ""} onChange={(e) => set("invoiceNumber", e.target.value)} />
              </Field>
              <Field label="Rechnungsdatum">
                <Input
                  type="date"
                  value={doc.invoiceDate ? String(doc.invoiceDate).slice(0, 10) : ""}
                  onChange={(e) => set("invoiceDate", e.target.value)}
                />
              </Field>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Netto">
                <Input type="number" step="0.01" value={doc.nettoAmount ?? ""} onChange={(e) => set("nettoAmount", e.target.value)} />
              </Field>
              <Field label="MwSt">
                <Input type="number" step="0.01" value={doc.vatAmount ?? ""} onChange={(e) => set("vatAmount", e.target.value)} />
              </Field>
              <Field label="Brutto">
                <Input type="number" step="0.01" value={doc.bruttoAmount ?? ""} onChange={(e) => set("bruttoAmount", e.target.value)} />
              </Field>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Währung">
                <Input value={doc.currency ?? "EUR"} onChange={(e) => set("currency", e.target.value)} />
              </Field>
              <Field label="Dokumenttyp">
                <select
                  value={doc.documentType ?? ""}
                  onChange={(e) => set("documentType", e.target.value || null)}
                  className="h-9 rounded-md border border-hairline bg-surface-card px-2 text-[14px] text-ink"
                >
                  <option value="">—</option>
                  {DOC_TYPES.map((t) => (
                    <option key={t} value={t}>{DOC_TYPE_LABEL[t]}</option>
                  ))}
                </select>
              </Field>
              <Field label="Wiederkehrend">
                <select
                  value={doc.isRecurring ? "1" : "0"}
                  onChange={(e) => set("isRecurring", e.target.value === "1")}
                  className="h-9 rounded-md border border-hairline bg-surface-card px-2 text-[14px] text-ink"
                >
                  <option value="0">Nein</option>
                  <option value="1">Ja</option>
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Straße">
                <Input value={doc.street ?? ""} onChange={(e) => set("street", e.target.value)} />
              </Field>
              <Field label="PLZ">
                <Input value={doc.postalCode ?? ""} onChange={(e) => set("postalCode", e.target.value)} />
              </Field>
              <Field label="Stadt">
                <Input value={doc.city ?? ""} onChange={(e) => set("city", e.target.value)} />
              </Field>
              <Field label="Land">
                <Input value={doc.country ?? ""} onChange={(e) => set("country", e.target.value)} />
              </Field>
            </div>
            <Field label="Semantische Tags (Komma-getrennt)">
              <Input value={tagInput} onChange={(e) => setTagInput(e.target.value)} />
            </Field>
            <div className="flex flex-wrap gap-1.5">
              {(doc.tags ?? []).map((t: any) => (
                <TagChip key={t.name} name={t.name} color={t.color} />
              ))}
            </div>

            <Field label="Notiz / Beschreibung (intern)">
              <textarea
                value={doc.note ?? ""}
                onChange={(e) => set("note", e.target.value)}
                rows={3}
                placeholder="Anmerkung der Geschäftsführung zur Rechnung…"
                className="w-full rounded-md border border-hairline bg-surface-card p-3 text-[14px] text-ink placeholder:text-ash focus:border-accent-blue focus:outline-none focus:ring-2 focus:ring-accent-blue/40"
              />
            </Field>

            <div className="mt-1 flex flex-wrap gap-2">
              <Button onClick={() => save(false)} disabled={saving} variant="secondary">
                <Save className="size-4" /> Speichern
              </Button>
              <Button onClick={() => save(true)} disabled={saving}>
                Geprüft & freigeben
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Public share link */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="size-4 text-mute" /> Öffentlicher Link
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-[13px] text-mute">
            Erzeugt einen Link ohne Login zur Rechnungsprüfung durch andere Mitarbeiter. Sichtbar
            sind nur PDF, Lieferantendaten und Beträge — keine Notizen oder Freigaben.
          </p>
          {shareUrl ? (
            <div className="flex flex-wrap items-center gap-2">
              <Input readOnly value={shareUrl} className="max-w-md font-mono text-[13px]" />
              <Button variant="secondary" size="sm" onClick={copyLink}>
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                {copied ? "Kopiert" : "Kopieren"}
              </Button>
              <a href={shareUrl} target="_blank" rel="noreferrer">
                <Button variant="tertiary" size="sm">Öffnen</Button>
              </a>
              <Button variant="tertiary" size="sm" onClick={revokeShare}>
                <X className="size-4" /> Widerrufen
              </Button>
            </div>
          ) : (
            <Button onClick={createShare} variant="secondary">
              <Link2 className="size-4" /> Öffentlichen Link erstellen
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Audit log */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="size-4 text-mute" /> Audit-Log
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1.5">
          {(doc.auditLogs ?? []).map((log: any) => (
            <div key={log.id} className="flex items-center justify-between rounded-md px-2 py-1.5 text-[13px] hover:bg-surface-soft">
              <div className="flex items-center gap-2">
                <Badge variant="outline">{log.action}</Badge>
                {log.field && (
                  <span className="text-body">
                    <span className="text-mute">{log.field}:</span>{" "}
                    <span className="line-through opacity-60">{log.oldValue || "—"}</span> → <span className="font-medium text-ink">{log.newValue || "—"}</span>
                  </span>
                )}
              </div>
              <span className="text-mute">{log.actor} · {formatDate(log.createdAt)}</span>
            </div>
          ))}
          {(doc.auditLogs ?? []).length === 0 && <p className="text-[13px] text-mute">Keine Einträge.</p>}
        </CardContent>
      </Card>
    </div>
  );
}

function numOrNull(v: unknown): number | null {
  if (v === "" || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function origin(): string {
  return typeof window !== "undefined" ? window.location.origin : "";
}
