"use client";

import { useRef, useState } from "react";
import { Send, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "Zeige die Kosten von Vodafone in den letzten 6 Monaten",
  "Warum sind die Kosten im Oktober gestiegen?",
  "Welche neuen Lieferanten sind in diesem Quartal aufgetaucht?",
  "Was sind unsere größten Kostentreiber dieses Jahr?",
];

export default function ChatPage() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  async function send(text: string) {
    const content = text.trim();
    if (!content || loading) return;
    const next = [...messages, { role: "user" as const, content }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      const data = await res.json();
      setMessages((m) => [
        ...m,
        { role: "assistant", content: res.ok ? data.reply : data.error ?? "Fehler bei der Analyse." },
      ]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "Netzwerkfehler." }]);
    } finally {
      setLoading(false);
      requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: 9e9, behavior: "smooth" }));
    }
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-9rem)] max-w-3xl flex-col gap-4">
      <header>
        <div className="eyebrow">AI-Analyse</div>
        <h1 className="mt-1 flex items-center gap-2 text-[24px] font-bold tracking-tight text-ink">
          <Sparkles className="size-5 text-primary" /> Controlling-Assistent
        </h1>
      </header>

      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-5">
          {messages.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
              <p className="text-[14px] text-mute">Stelle eine Frage zu deinen Eingangsrechnungen.</p>
              <div className="grid w-full max-w-lg grid-cols-1 gap-2 sm:grid-cols-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="rounded-md border border-hairline bg-surface-card px-3 py-2 text-left text-[13px] text-body hover:bg-surface-soft"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[80%] whitespace-pre-wrap rounded-md px-4 py-2.5 text-[14px] leading-relaxed",
                  m.role === "user"
                    ? "bg-ink text-on-dark"
                    : "border border-hairline bg-surface-doc text-body",
                )}
              >
                {m.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex items-center gap-2 text-[13px] text-mute">
              <Loader2 className="size-4 animate-spin" /> Analysiere Daten…
            </div>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="flex items-center gap-2 border-t border-hairline-soft p-3"
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Frage zu Kosten, Lieferanten, Trends…"
            disabled={loading}
          />
          <Button type="submit" size="icon" disabled={loading || !input.trim()}>
            <Send className="size-4" />
          </Button>
        </form>
      </Card>
    </div>
  );
}
