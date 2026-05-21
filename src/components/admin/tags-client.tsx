"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TagChip } from "@/components/ui/badge";

type Tag = { id: string; name: string; color: string; count: number };
type Rule = { id: string; contains: string; field: string; tagId: string };

const selectCls = "h-9 rounded-md border border-hairline bg-surface-card px-2 text-[14px] text-ink";

export function TagsClient({ initialTags, initialRules }: { initialTags: Tag[]; initialRules: Rule[] }) {
  const [tags, setTags] = useState(initialTags);
  const [rules, setRules] = useState(initialRules);
  const [newTag, setNewTag] = useState("");
  const [rContains, setRContains] = useState("");
  const [rField, setRField] = useState("vendor");
  const [rTag, setRTag] = useState(initialTags[0]?.id ?? "");

  const tagById = (id: string) => tags.find((t) => t.id === id);

  async function addTag(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/tags", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newTag }),
    });
    const data = await res.json();
    if (res.ok) {
      setTags((t) => (t.some((x) => x.id === data.tag.id) ? t : [...t, { ...data.tag, count: 0 }].sort((a, b) => a.name.localeCompare(b.name))));
      setNewTag("");
    } else alert(data.error ?? "Fehler");
  }

  async function recolor(id: string, color: string) {
    setTags((t) => t.map((x) => (x.id === id ? { ...x, color } : x)));
    await fetch(`/api/tags/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ color }) });
  }

  async function delTag(id: string) {
    if (!confirm("Tag löschen? Zuordnungen und Regeln gehen verloren.")) return;
    const res = await fetch(`/api/tags/${id}`, { method: "DELETE" });
    if (res.ok) {
      setTags((t) => t.filter((x) => x.id !== id));
      setRules((r) => r.filter((x) => x.tagId !== id));
    }
  }

  async function addRule(e: React.FormEvent) {
    e.preventDefault();
    if (!rTag || !rContains.trim()) return;
    const res = await fetch("/api/tag-rules", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contains: rContains, field: rField, tagId: rTag }),
    });
    const data = await res.json();
    if (res.ok) { setRules((r) => [...r, data.rule]); setRContains(""); }
    else alert(data.error ?? "Fehler");
  }

  async function delRule(id: string) {
    const res = await fetch(`/api/tag-rules?id=${id}`, { method: "DELETE" });
    if (res.ok) setRules((r) => r.filter((x) => x.id !== id));
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <div className="eyebrow">Verwaltung</div>
        <h1 className="mt-1 text-[24px] font-bold tracking-tight text-ink">Tags & Regeln</h1>
      </header>

      <Card>
        <CardHeader><CardTitle>Semantische Tags</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-4">
          <form onSubmit={addTag} className="flex items-end gap-2">
            <Input value={newTag} onChange={(e) => setNewTag(e.target.value)} placeholder="z. B. mobilfunk" className="w-56" />
            <Button type="submit"><Plus className="size-4" /> Tag</Button>
          </form>
          <div className="flex flex-wrap gap-3">
            {tags.map((t) => (
              <div key={t.id} className="flex items-center gap-2 rounded-md border border-hairline-soft px-2 py-1.5">
                <input type="color" value={t.color} onChange={(e) => recolor(t.id, e.target.value)} className="size-6 cursor-pointer rounded" />
                <TagChip name={t.name} color={t.color} />
                <span className="text-[12px] text-mute">{t.count}×</span>
                <button onClick={() => delTag(t.id)} className="text-mute hover:text-accent-red"><Trash2 className="size-4" /></button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Auto-Tagging Regeln</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-[13px] text-mute">
            Wenn der Lieferant (oder OCR-Text) den Begriff enthält, wird der Tag bei der Verarbeitung automatisch gesetzt.
            Beispiel: <span className="font-mono">shell</span> → <span className="font-mono">kraftstoff</span>.
          </p>
          <form onSubmit={addRule} className="flex flex-wrap items-end gap-2">
            <select value={rField} onChange={(e) => setRField(e.target.value)} className={selectCls}>
              <option value="vendor">Lieferant enthält</option>
              <option value="text">OCR-Text enthält</option>
            </select>
            <Input value={rContains} onChange={(e) => setRContains(e.target.value)} placeholder="Begriff" className="w-44" />
            <span className="text-mute">→</span>
            <select value={rTag} onChange={(e) => setRTag(e.target.value)} className={selectCls}>
              {tags.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <Button type="submit"><Plus className="size-4" /> Regel</Button>
          </form>
          <div className="flex flex-col gap-1.5">
            {rules.map((r) => {
              const tag = tagById(r.tagId);
              return (
                <div key={r.id} className="flex items-center justify-between rounded-md border border-hairline-soft px-3 py-2 text-[14px]">
                  <div className="flex items-center gap-2">
                    <span className="text-mute">{r.field === "text" ? "OCR-Text" : "Lieferant"} enthält</span>
                    <span className="font-mono text-ink">{r.contains}</span>
                    <span className="text-mute">→</span>
                    {tag && <TagChip name={tag.name} color={tag.color} />}
                  </div>
                  <button onClick={() => delRule(r.id)} className="text-mute hover:text-accent-red"><Trash2 className="size-4" /></button>
                </div>
              );
            })}
            {rules.length === 0 && <p className="text-[13px] text-mute">Noch keine Regeln.</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
