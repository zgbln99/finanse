import { notFound } from "next/navigation";
import { Boxes } from "lucide-react";
import { prisma } from "@/lib/db";
import { TagChip } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { DOC_TYPE_LABEL } from "@/lib/labels";

export const dynamic = "force-dynamic";

export const metadata = { title: "Rechnung · LTS Logistik", robots: { index: false } };

/**
 * Standalone public invoice view (no login, no cockpit chrome).
 * Shows only the PDF, vendor data and amounts — never internal notes,
 * approvals or audit history.
 */
export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const doc = await prisma.document.findUnique({
    where: { shareToken: token },
    include: { tags: { include: { tag: true } } },
  });
  if (!doc) notFound();

  const netto = doc.nettoAmount ? Number(doc.nettoAmount) : null;
  const vat = doc.vatAmount ? Number(doc.vatAmount) : null;
  const brutto = doc.bruttoAmount ? Number(doc.bruttoAmount) : null;

  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-hairline bg-canvas">
        <div className="mx-auto flex max-w-5xl items-center gap-2 px-6 py-4">
          <span className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-fg">
            <Boxes className="size-5" />
          </span>
          <div className="leading-tight">
            <div className="text-[15px] font-bold text-ink">LTS Logistik GmbH</div>
            <div className="text-[12px] text-mute">Rechnungsprüfung · geteilte Ansicht</div>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-5xl grid-cols-1 gap-6 px-6 py-8 lg:grid-cols-2">
        <div className="rounded-md border border-hairline bg-surface-card">
          <iframe
            src={`/api/share/${token}/file`}
            className="h-[78vh] w-full rounded-md bg-surface-soft"
            title="Rechnung PDF"
          />
        </div>

        <div className="flex flex-col gap-5">
          <div>
            <div className="eyebrow">Lieferant</div>
            <h1 className="mt-1 text-[22px] font-bold text-ink">{doc.vendorName ?? "Unbekannt"}</h1>
            <div className="mt-1 text-[14px] text-body">
              {[doc.street, [doc.postalCode, doc.city].filter(Boolean).join(" "), doc.country]
                .filter(Boolean)
                .join(", ") || "—"}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {doc.tags.map((t) => (
                <TagChip key={t.tag.name} name={t.tag.name} color={t.tag.color} />
              ))}
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-hairline bg-hairline text-[14px]">
            <Row label="Dokumenttyp" value={doc.documentType ? DOC_TYPE_LABEL[doc.documentType] : "—"} />
            <Row label="Rechnungsnummer" value={doc.invoiceNumber ?? "—"} mono />
            <Row label="Rechnungsdatum" value={formatDate(doc.invoiceDate)} />
            <Row label="Währung" value={doc.currency} />
            <Row label="Netto" value={formatCurrency(netto, doc.currency)} />
            <Row label="MwSt" value={formatCurrency(vat, doc.currency)} />
          </dl>

          <div className="rounded-md border border-hairline bg-surface-card p-5">
            <div className="eyebrow">Gesamtbetrag (Brutto)</div>
            <div className="mt-1 text-[32px] font-bold tracking-tight text-ink">
              {formatCurrency(brutto, doc.currency)}
            </div>
          </div>

          <p className="text-[12px] text-mute">
            Diese Ansicht zeigt ausschließlich die Rechnungsdaten. Interne Notizen, Freigaben und
            der Bearbeitungsverlauf sind nicht enthalten.
          </p>
        </div>
      </main>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="bg-surface-card px-4 py-3">
      <dt className="text-[12px] uppercase tracking-wide text-mute">{label}</dt>
      <dd className={`mt-0.5 text-ink ${mono ? "font-mono text-[13px]" : ""}`}>{value}</dd>
    </div>
  );
}
