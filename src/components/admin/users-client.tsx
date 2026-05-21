"use client";

import { useState } from "react";
import { UserPlus, Trash2, KeyRound } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/utils";

export type UserRow = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  createdAt: string;
};

const ROLES = [
  { value: "admin", label: "Administrator" },
  { value: "manager", label: "Geschäftsführung" },
  { value: "employee", label: "Mitarbeiter" },
];

const selectCls = "h-9 rounded-md border border-hairline bg-surface-card px-2 text-[14px] text-ink";

export function UsersClient({ initial, meId }: { initial: UserRow[]; meId: string }) {
  const [users, setUsers] = useState(initial);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("employee");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, name, role, password }),
    });
    const data = await res.json();
    if (res.ok) {
      setUsers((u) => [...u, data.user]);
      setEmail(""); setName(""); setPassword(""); setRole("employee");
    } else setError(data.error ?? "Fehler");
    setBusy(false);
  }

  async function changeRole(id: string, role: string) {
    const res = await fetch(`/api/users/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role }),
    });
    const data = await res.json();
    if (res.ok) setUsers((u) => u.map((x) => (x.id === id ? data.user : x)));
    else alert(data.error ?? "Fehler");
  }

  async function resetPw(id: string) {
    const pw = prompt("Neues Passwort (min. 8 Zeichen):");
    if (!pw) return;
    const res = await fetch(`/api/users/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: pw }),
    });
    if (res.ok) alert("Passwort geändert.");
    else alert((await res.json()).error ?? "Fehler");
  }

  async function remove(id: string) {
    if (!confirm("Benutzer wirklich löschen?")) return;
    const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
    if (res.ok) setUsers((u) => u.filter((x) => x.id !== id));
    else alert((await res.json()).error ?? "Fehler");
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <div className="eyebrow">Verwaltung</div>
        <h1 className="mt-1 text-[24px] font-bold tracking-tight text-ink">Benutzer</h1>
      </header>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><UserPlus className="size-4 text-mute" /> Neuer Benutzer</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={create} className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-[12px] font-semibold uppercase tracking-wide text-mute">E-Mail</span>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-56" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[12px] font-semibold uppercase tracking-wide text-mute">Name</span>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="w-40" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[12px] font-semibold uppercase tracking-wide text-mute">Rolle</span>
              <select value={role} onChange={(e) => setRole(e.target.value)} className={selectCls}>
                {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[12px] font-semibold uppercase tracking-wide text-mute">Passwort</span>
              <Input type="text" value={password} onChange={(e) => setPassword(e.target.value)} required className="w-48" />
            </label>
            <Button type="submit" disabled={busy}>Anlegen</Button>
          </form>
          {error && <p className="mt-2 text-[13px] text-accent-red">{error}</p>}
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>E-Mail</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Rolle</TableHead>
              <TableHead>Erstellt</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium text-ink">{u.email}</TableCell>
                <TableCell>{u.name ?? "—"}</TableCell>
                <TableCell>
                  <select value={u.role} onChange={(e) => changeRole(u.id, e.target.value)} className={selectCls}>
                    {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </TableCell>
                <TableCell>{formatDate(u.createdAt)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="tertiary" onClick={() => resetPw(u.id)} title="Passwort ändern">
                      <KeyRound className="size-4" />
                    </Button>
                    {u.id !== meId && (
                      <Button size="sm" variant="tertiary" onClick={() => remove(u.id)} title="Löschen">
                        <Trash2 className="size-4 text-accent-red" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
