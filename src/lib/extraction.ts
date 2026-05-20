import { z } from "zod";
import { getOpenAI, OPENAI_MODEL, OWN_COMPANY } from "./openai";
import { normalizeTag } from "./tags";

/** Structured result the AI must return for each invoice. */
export const ExtractionSchema = z.object({
  vendorName: z.string().nullable(),
  city: z.string().nullable(),
  street: z.string().nullable(),
  postalCode: z.string().nullable(),
  country: z.string().nullable(),
  invoiceNumber: z.string().nullable(),
  invoiceDate: z.string().nullable(), // ISO YYYY-MM-DD
  nettoAmount: z.number().nullable(),
  vatAmount: z.number().nullable(),
  bruttoAmount: z.number().nullable(),
  currency: z.string().nullable(),
  documentType: z
    .enum(["rechnung", "gutschrift", "mahnung", "angebot", "lieferschein", "sonstiges"])
    .nullable(),
  tags: z.array(z.string()).default([]),
  isRecurring: z.boolean().default(false),
  confidence: z.number().min(0).max(1),
  fieldConfidence: z.record(z.number()).default({}),
});

export type ExtractionResult = z.infer<typeof ExtractionSchema>;

const SYSTEM_PROMPT = `Du bist ein Buchhaltungs-Assistent für die ${OWN_COMPANY}, ein Logistikunternehmen.
Du extrahierst strukturierte Daten aus dem OCR-Text einer eingegangenen Rechnung (Eingangsrechnung).

WICHTIGE REGELN:
- Verwende deutsche Buchhaltungs-Terminologie.
- "${OWN_COMPANY}" (bzw. LTS Logistik) ist IMMER der Kunde/Rechnungsempfänger, NIEMALS der Lieferant (vendor). Trage als vendorName ausschließlich den ausstellenden Lieferanten ein.
- Betraege als Zahl ohne Tausenderpunkt, Dezimaltrennzeichen als Punkt (z.B. 1234.56).
- nettoAmount + vatAmount sollten bruttoAmount ergeben; korrigiere offensichtliche OCR-Fehler wenn sicher.
- invoiceDate im Format YYYY-MM-DD.
- currency als ISO-Code (EUR, USD, ...). Standard EUR.
- documentType: rechnung, gutschrift, mahnung, angebot, lieferschein oder sonstiges.
- tags: 1-4 KURZE, deutsche, geschäftliche Schlagworte (lowercase, ein Wort), z.B. mobilfunk, fracht, maut, kraftstoff, fahrzeugwaesche, softwareabo, hosting, fahrzeugpruefung, versicherung, leasing, wartung, energie. Keine Umlaute (ae/oe/ue/ss).
- isRecurring: true bei offensichtlich wiederkehrenden Leistungen (Abos, Mobilfunk, Hosting, Leasing).
- confidence: Gesamteinschätzung 0..1. fieldConfidence: pro Feld 0..1.
- Wenn ein Wert unbekannt ist, gib null zurück. Niemals raten.

Antworte ausschließlich mit einem JSON-Objekt.`;

const JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    vendorName: { type: ["string", "null"] },
    city: { type: ["string", "null"] },
    street: { type: ["string", "null"] },
    postalCode: { type: ["string", "null"] },
    country: { type: ["string", "null"] },
    invoiceNumber: { type: ["string", "null"] },
    invoiceDate: { type: ["string", "null"] },
    nettoAmount: { type: ["number", "null"] },
    vatAmount: { type: ["number", "null"] },
    bruttoAmount: { type: ["number", "null"] },
    currency: { type: ["string", "null"] },
    documentType: {
      type: ["string", "null"],
      enum: ["rechnung", "gutschrift", "mahnung", "angebot", "lieferschein", "sonstiges", null],
    },
    tags: { type: "array", items: { type: "string" } },
    isRecurring: { type: "boolean" },
    confidence: { type: "number" },
    fieldConfidence: { type: "object", additionalProperties: { type: "number" } },
  },
  required: [
    "vendorName",
    "city",
    "street",
    "postalCode",
    "country",
    "invoiceNumber",
    "invoiceDate",
    "nettoAmount",
    "vatAmount",
    "bruttoAmount",
    "currency",
    "documentType",
    "tags",
    "isRecurring",
    "confidence",
    "fieldConfidence",
  ],
} as const;

export async function extractInvoiceFields(ocrText: string): Promise<ExtractionResult> {
  const openai = getOpenAI();
  const trimmed = ocrText.slice(0, 16_000); // keep prompt bounded

  const completion = await openai.chat.completions.create({
    model: OPENAI_MODEL,
    temperature: 0,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "invoice_extraction",
        strict: true,
        schema: JSON_SCHEMA as unknown as Record<string, unknown>,
      },
    },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `OCR-Text der Eingangsrechnung:\n"""\n${trimmed}\n"""`,
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  const parsed = ExtractionSchema.parse(JSON.parse(raw));

  // Guard the core business rule and normalize tags.
  if (
    parsed.vendorName &&
    parsed.vendorName.toLowerCase().includes("lts logistik")
  ) {
    parsed.vendorName = null;
  }
  parsed.tags = Array.from(
    new Set(parsed.tags.map(normalizeTag).filter((t) => t.length >= 3)),
  ).slice(0, 4);
  parsed.currency = (parsed.currency || "EUR").toUpperCase();

  return parsed;
}
