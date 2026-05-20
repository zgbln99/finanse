"use client";

import { useRef, useState } from "react";
import { UploadCloud, FolderSearch, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function ImportPanel({ onDone }: { onDone?: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function upload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    setMsg(null);
    const fd = new FormData();
    Array.from(files).forEach((f) => fd.append("files", f));
    try {
      const res = await fetch("/api/invoices", { method: "POST", body: fd });
      const data = await res.json();
      setMsg(`${data.count ?? 0} Datei(en) in die Verarbeitungskolonne gestellt.`);
      onDone?.();
    } catch {
      setMsg("Upload fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  async function scanFolder() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/import/scan", { method: "POST" });
      const data = await res.json();
      setMsg(res.ok ? `${data.enqueued} PDF(s) aus dem Ordner eingereiht.` : data.error);
      onDone?.();
    } catch {
      setMsg("Ordner-Scan fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-[16px] font-semibold text-ink">Dokumente importieren</h3>
          <p className="text-[13px] text-mute">
            PDF hochladen oder den überwachten Ordner (lokal / rclone Google Drive) scannen.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf"
            multiple
            className="hidden"
            onChange={(e) => upload(e.target.files)}
          />
          <Button variant="secondary" onClick={scanFolder} disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <FolderSearch className="size-4" />}
            Ordner scannen
          </Button>
          <Button onClick={() => inputRef.current?.click()} disabled={busy}>
            <UploadCloud className="size-4" />
            PDF hochladen
          </Button>
        </div>
      </div>
      {msg && <p className="mt-3 text-[13px] text-link-teal">{msg}</p>}
    </Card>
  );
}
