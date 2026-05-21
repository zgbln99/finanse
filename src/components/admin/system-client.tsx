"use client";

import { useEffect, useState } from "react";
import { RefreshCw, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { formatDate } from "@/lib/utils";
import { STATUS_LABEL } from "@/lib/labels";

type Data = {
  redisOk: boolean;
  queue: { waiting: number; active: number; completed: number; failed: number; delayed: number };
  documents: Record<string, number>;
  recentFailed: { id: string; originalName: string; errorMessage: string | null; updatedAt: string }[];
};

export function SystemClient() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/system/queue");
    setData(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 5000); // live refresh
    return () => clearInterval(t);
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-end justify-between">
        <div>
          <div className="eyebrow">Verwaltung</div>
          <h1 className="mt-1 text-[24px] font-bold tracking-tight text-ink">System & Verarbeitung</h1>
        </div>
        <div className="flex items-center gap-2 text-[13px] text-mute">
          {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          Live (5s)
        </div>
      </header>

      <div className="flex items-center gap-2 text-[14px]">
        <span className="text-mute">Redis / Queue:</span>
        {data?.redisOk ? <Badge variant="green">verbunden</Badge> : <Badge variant="red">nicht erreichbar</Badge>}
      </div>

      <div>
        <div className="eyebrow mb-2">Warteschlange</div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          <KpiCard label="Wartend" value={data?.queue.waiting ?? 0} />
          <KpiCard label="Aktiv" value={data?.queue.active ?? 0} />
          <KpiCard label="Verzögert" value={data?.queue.delayed ?? 0} />
          <KpiCard label="Fertig" value={data?.queue.completed ?? 0} />
          <KpiCard label="Fehlgeschlagen" value={data?.queue.failed ?? 0} />
        </div>
      </div>

      <div>
        <div className="eyebrow mb-2">Dokumente nach Status</div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          {["pending", "processing", "completed", "needs_review", "failed"].map((s) => (
            <KpiCard key={s} label={STATUS_LABEL[s] ?? s} value={data?.documents[s] ?? 0} />
          ))}
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Zuletzt fehlgeschlagen</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-1.5">
          {(data?.recentFailed ?? []).map((d) => (
            <a key={d.id} href={`/invoices/${d.id}`} className="flex items-center justify-between rounded-md px-2 py-1.5 text-[13px] hover:bg-surface-soft">
              <span className="font-medium text-ink">{d.originalName}</span>
              <span className="truncate pl-4 text-accent-red">{d.errorMessage ?? "—"}</span>
              <span className="pl-4 text-mute">{formatDate(d.updatedAt)}</span>
            </a>
          ))}
          {(data?.recentFailed ?? []).length === 0 && <p className="text-[13px] text-mute">Keine Fehler. 🎉</p>}
        </CardContent>
      </Card>
    </div>
  );
}
