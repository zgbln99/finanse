"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ReprocessButtons() {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function run(scope: "failed" | "review") {
    setBusy(scope);
    setMsg(null);
    const res = await fetch(`/api/admin/reprocess?scope=${scope}`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    if (res.ok) {
      setMsg(`${data.enqueued ?? 0} Dokument(e) zur Neuverarbeitung eingereiht.`);
      setTimeout(() => router.refresh(), 1500);
    } else {
      setMsg(data.error ?? "Fehler.");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="secondary" size="sm" disabled={busy !== null} onClick={() => run("failed")}>
        {busy === "failed" ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
        Fehlgeschlagene neu verarbeiten
      </Button>
      <Button variant="secondary" size="sm" disabled={busy !== null} onClick={() => run("review")}>
        {busy === "review" ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
        Prüf-Dokumente neu verarbeiten
      </Button>
      {msg && <span className="text-[13px] text-link-teal">{msg}</span>}
    </div>
  );
}
