import Link from "next/link";
import { ShieldCheck, AlertTriangle, ChevronRight, Flag, Copy } from "lucide-react";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, TagChip } from "@/components/ui/badge";
import { ReprocessButtons } from "@/components/review/reprocess-buttons";
import { formatCurrency, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

const THRESHOLD = Number(process.env.AI_CONFIDENCE_THRESHOLD ?? "0.8");

export default async function ReviewPage() {
  const [needsReview, failed, flagged] = await Promise.all([
    prisma.document.findMany({
      where: { status: "needs_review" },
      orderBy: { confidence: "asc" },
      include: { tags: { include: { tag: true } } },
      take: 100,
    }),
    prisma.document.findMany({
      where: { status: "failed" },
      orderBy: { updatedAt: "desc" },
      take: 50,
    }),
    prisma.document.findMany({
      where: { OR: [{ isAnomaly: true }, { isDuplicate: true }] },
      orderBy: { invoiceDate: "desc" },
      take: 100,
    }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <div className="eyebrow">AI Review Workflow</div>
        <h1 className="mt-1 text-[24px] font-bold tracking-tight text-ink">Prüfung</h1>
        <p className="mt-1 text-[14px] text-mute">
          Dokumente unterhalb der Konfidenzschwelle von {Math.round(THRESHOLD * 100)}% sowie
          fehlgeschlagene Verarbeitungen. Korrekturen trainieren das AI-Korrektur-Gedächtnis.
        </p>
        <div className="mt-3">
          <ReprocessButtons />
        </div>
      </header>

      {flagged.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Flag className="size-4 text-accent-red" />
              Auffällige Rechnungen ({flagged.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {flagged.map((d) => (
              <Link
                key={d.id}
                href={`/invoices/${d.id}`}
                className="flex items-center justify-between rounded-md border border-hairline-soft px-3 py-2.5 hover:bg-surface-soft"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-ink">{d.vendorName ?? "Unbekannt"}</span>
                    {d.isDuplicate && <Badge variant="purple"><Copy className="size-3" /> Duplikat</Badge>}
                    {d.isAnomaly && <Badge variant="red"><AlertTriangle className="size-3" /> Anomalie</Badge>}
                  </div>
                  <div className="text-[12px] text-mute">{d.anomalyReason ?? ""}</div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-ink">{formatCurrency(d.bruttoAmount ? Number(d.bruttoAmount) : null)}</span>
                  <ChevronRight className="size-4 text-mute" />
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-accent-purple" />
            Niedrige Konfidenz ({needsReview.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {needsReview.map((d) => (
            <Link
              key={d.id}
              href={`/invoices/${d.id}`}
              className="flex items-center justify-between rounded-md border border-hairline-soft px-3 py-2.5 hover:bg-surface-soft"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-ink">{d.vendorName ?? "Unbekannt"}</span>
                  <span className="font-mono text-[12px] text-mute">{d.invoiceNumber ?? "—"}</span>
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[12px] text-mute">
                  <span>{formatDate(d.invoiceDate)}</span>
                  {d.tags.slice(0, 3).map((t) => (
                    <TagChip key={t.tag.name} name={t.tag.name} color={t.tag.color} />
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-semibold text-ink">{formatCurrency(d.bruttoAmount ? Number(d.bruttoAmount) : null)}</span>
                <Badge variant="purple">{d.confidence != null ? Math.round(d.confidence * 100) : "?"}%</Badge>
                <ChevronRight className="size-4 text-mute" />
              </div>
            </Link>
          ))}
          {needsReview.length === 0 && (
            <p className="py-6 text-center text-[14px] text-mute">Alles geprüft — keine offenen Dokumente.</p>
          )}
        </CardContent>
      </Card>

      {failed.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-accent-red" />
              Fehlgeschlagen ({failed.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {failed.map((d) => (
              <Link
                key={d.id}
                href={`/invoices/${d.id}`}
                className="flex items-center justify-between rounded-md border border-hairline-soft px-3 py-2.5 hover:bg-surface-soft"
              >
                <div>
                  <div className="font-medium text-ink">{d.originalName}</div>
                  <div className="text-[12px] text-accent-red">{d.errorMessage ?? "Unbekannter Fehler"}</div>
                </div>
                <ChevronRight className="size-4 text-mute" />
              </Link>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
