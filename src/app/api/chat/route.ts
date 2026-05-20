import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getOpenAI, OPENAI_MODEL, OWN_COMPANY, isOpenAIConfigured } from "@/lib/openai";

export const dynamic = "force-dynamic";

type ChatMessage = { role: "user" | "assistant"; content: string };

function toNum(d: unknown): number {
  if (d == null) return 0;
  return typeof d === "object" && "toNumber" in (d as object)
    ? (d as { toNumber(): number }).toNumber()
    : Number(d);
}

/** Build a compact, factual data brief the model can reason over. */
async function buildContext(): Promise<string> {
  const now = new Date();
  const docs = await prisma.document.findMany({
    where: { status: { in: ["completed", "needs_review"] }, invoiceDate: { not: null } },
    select: {
      vendorName: true,
      bruttoAmount: true,
      invoiceDate: true,
      isRecurring: true,
      documentType: true,
      tags: { select: { tag: { select: { name: true } } } },
    },
  });

  const monthly = new Map<string, number>();
  const vendorMonthly = new Map<string, Map<string, number>>();
  const tagTotals = new Map<string, number>();
  const vendorFirstSeen = new Map<string, Date>();

  for (const d of docs) {
    const date = d.invoiceDate as Date;
    const mk = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const amt = toNum(d.bruttoAmount);
    monthly.set(mk, (monthly.get(mk) ?? 0) + amt);

    const v = d.vendorName ?? "Unbekannt";
    if (!vendorMonthly.has(v)) vendorMonthly.set(v, new Map());
    const vm = vendorMonthly.get(v)!;
    vm.set(mk, (vm.get(mk) ?? 0) + amt);

    const prev = vendorFirstSeen.get(v);
    if (!prev || date < prev) vendorFirstSeen.set(v, date);

    for (const t of d.tags) tagTotals.set(t.tag.name, (tagTotals.get(t.tag.name) ?? 0) + amt);
  }

  const monthlyLines = [...monthly.entries()]
    .sort()
    .slice(-14)
    .map(([m, v]) => `${m}: ${v.toFixed(2)} EUR`)
    .join("\n");

  const vendorLines = [...vendorMonthly.entries()]
    .map(([vendor, m]) => {
      const total = [...m.values()].reduce((a, b) => a + b, 0);
      const recent = [...m.entries()].sort().slice(-6).map(([mk, v]) => `${mk}=${v.toFixed(0)}`).join(", ");
      return { vendor, total, line: `${vendor} (gesamt ${total.toFixed(0)} EUR) | letzte 6M: ${recent}` };
    })
    .sort((a, b) => b.total - a.total)
    .slice(0, 25)
    .map((x) => x.line)
    .join("\n");

  const tagLines = [...tagTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([t, v]) => `${t}: ${v.toFixed(0)} EUR`)
    .join("\n");

  const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
  const newVendors = [...vendorFirstSeen.entries()]
    .filter(([, d]) => d >= quarterStart)
    .map(([v, d]) => `${v} (erstmals ${d.toISOString().slice(0, 10)})`)
    .join("\n") || "keine";

  return `Heutiges Datum: ${now.toISOString().slice(0, 10)}
Unternehmen (immer Kunde): ${OWN_COMPANY}

MONATLICHE GESAMTKOSTEN (Brutto):
${monthlyLines}

KOSTEN PRO LIEFERANT (Top 25, mit Verlauf der letzten 6 Monate):
${vendorLines}

KOSTEN PRO TAG:
${tagLines}

NEUE LIEFERANTEN IN DIESEM QUARTAL:
${newVendors}`;
}

export async function POST(req: NextRequest) {
  if (!isOpenAIConfigured()) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY ist nicht konfiguriert. AI-Analyse nicht verfügbar." },
      { status: 503 },
    );
  }

  const { messages } = (await req.json()) as { messages: ChatMessage[] };
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "Keine Nachrichten" }, { status: 400 });
  }

  const context = await buildContext();
  const openai = getOpenAI();

  const completion = await openai.chat.completions.create({
    model: OPENAI_MODEL,
    temperature: 0.2,
    messages: [
      {
        role: "system",
        content: `Du bist der Controlling-Analyst von ${OWN_COMPANY}. Beantworte Fragen zu Eingangsrechnungen und Kosten auf Deutsch, präzise und mit konkreten Zahlen aus dem bereitgestellten Datenkontext. Wenn Daten fehlen, sage das klar. Nutze kurze Absätze oder Listen. Erfinde keine Zahlen.

DATENKONTEXT:
${context}`,
      },
      ...messages.slice(-8).map((m) => ({ role: m.role, content: m.content })),
    ],
  });

  const reply = completion.choices[0]?.message?.content ?? "Keine Antwort.";
  return NextResponse.json({ reply });
}
