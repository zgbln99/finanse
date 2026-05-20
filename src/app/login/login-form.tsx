"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Boxes, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (res.ok) {
      router.replace(next);
      router.refresh();
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Anmeldung fehlgeschlagen");
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-sm">
      <div className="mb-6 flex items-center gap-2">
        <span className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-fg">
          <Boxes className="size-5" />
        </span>
        <div className="leading-tight">
          <div className="text-[16px] font-bold text-ink">Rechnungs-Cockpit</div>
          <div className="text-[12px] text-mute">LTS Logistik GmbH</div>
        </div>
      </div>

      <form onSubmit={submit} className="flex flex-col gap-3 rounded-md border border-hairline bg-surface-card p-6">
        <h1 className="text-[18px] font-semibold text-ink">Anmelden</h1>
        <label className="flex flex-col gap-1">
          <span className="text-[12px] font-semibold uppercase tracking-wide text-mute">E-Mail</span>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[12px] font-semibold uppercase tracking-wide text-mute">Passwort</span>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        {error && <p className="text-[13px] text-accent-red">{error}</p>}
        <Button type="submit" disabled={loading} className="mt-1">
          {loading && <Loader2 className="size-4 animate-spin" />}
          Anmelden
        </Button>
      </form>
    </div>
  );
}
