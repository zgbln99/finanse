import Link from "next/link";
import { AlertTriangle, Repeat, Receipt } from "lucide-react";
import { getDashboardStats } from "@/lib/analytics";
import { getActiveYear } from "@/lib/year";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { CostHeatmap } from "@/components/dashboard/heatmap";
import {
  CostTrendChart,
  KwBarChart,
  TagPieChart,
  VendorBarChart,
} from "@/components/dashboard/charts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TagChip, Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const year = await getActiveYear();
  const s = await getDashboardStats(year);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="eyebrow">Controlling Cockpit · {year}</div>
          <h1 className="mt-1 text-[24px] font-bold tracking-tight text-ink">Kostenübersicht</h1>
        </div>
        {s.kpis.reviewCount > 0 && (
          <Link href="/review">
            <Badge variant="red" className="gap-1.5 px-3 py-1 text-[13px]">
              <AlertTriangle className="size-3.5" />
              {s.kpis.reviewCount} Dokumente zur Prüfung
            </Badge>
          </Link>
        )}
      </header>

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Gesamtkosten dieses Jahr" value={s.kpis.totalYear} currency />
        <KpiCard
          label="Gesamtkosten dieser Monat"
          value={s.kpis.totalThisMonth}
          currency
          delta={s.kpis.momChange}
          hint="ggü. Vormonat"
        />
        <KpiCard label="Lieferanten" value={s.kpis.vendorCount} hint={`${s.kpis.documentCount} Belege`} />
        <KpiCard
          label="Offen / Prüfung"
          value={`${s.kpis.pendingCount} / ${s.kpis.reviewCount}`}
          hint={s.kpis.failedCount > 0 ? `${s.kpis.failedCount} fehlgeschlagen` : "in Bearbeitung"}
        />
      </div>

      {/* Trend + tag pie */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Kostentrend (14 Monate)</CardTitle>
          </CardHeader>
          <CardContent>
            <CostTrendChart data={s.trend} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Kosten pro Tag</CardTitle>
          </CardHeader>
          <CardContent>
            <TagPieChart data={s.byTag.slice(0, 8)} />
            <div className="mt-3 flex flex-wrap gap-1.5">
              {s.byTag.slice(0, 8).map((t) => (
                <TagChip key={t.name} name={t.name} color={t.color} />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Vendor bar + KW bar */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top Lieferanten</CardTitle>
          </CardHeader>
          <CardContent>
            <VendorBarChart data={s.topVendors} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Kosten pro Kalenderwoche</CardTitle>
          </CardHeader>
          <CardContent>
            <KwBarChart data={s.byKW} />
          </CardContent>
        </Card>
      </div>

      {/* Heatmap */}
      <Card>
        <CardHeader>
          <CardTitle>Kosten-Heatmap · Tag × Monat</CardTitle>
        </CardHeader>
        <CardContent>
          <CostHeatmap months={s.heatmap.months} rows={s.heatmap.rows} />
        </CardContent>
      </Card>

      {/* Largest + recurring */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="size-4 text-mute" /> Größte Rechnungen
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {s.largest.map((l) => (
              <Link
                key={l.id}
                href={`/invoices/${l.id}`}
                className="flex items-center justify-between rounded-md px-2 py-2 hover:bg-surface-soft"
              >
                <div>
                  <div className="font-medium text-ink">{l.vendor}</div>
                  <div className="text-[12px] text-mute">{formatDate(l.date)}</div>
                </div>
                <div className="font-semibold text-ink">{formatCurrency(l.amount)}</div>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Repeat className="size-4 text-mute" /> Wiederkehrende Rechnungen
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {s.recurringVendors.map((r) => (
              <div key={r.vendor} className="flex items-center justify-between rounded-md px-2 py-2">
                <div>
                  <div className="font-medium text-ink">{r.vendor}</div>
                  <div className="text-[12px] text-mute">{r.count} Belege</div>
                </div>
                <div className="font-semibold text-ink">{formatCurrency(r.total)}</div>
              </div>
            ))}
            {s.recurringVendors.length === 0 && (
              <p className="text-[14px] text-mute">Noch keine wiederkehrenden Rechnungen erkannt.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
