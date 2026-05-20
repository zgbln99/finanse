# Rechnungs-Cockpit · AI-native Rechnungseingang & Controlling

Ein AI-first Finance Cockpit für die **LTS Logistik GmbH**: PDF-Eingangsrechnungen
werden automatisch importiert, per OCR gelesen, mit OpenAI (`gpt-4.1-mini`)
strukturiert extrahiert, semantisch verschlagwortet und in einem visuellen
Controlling-Dashboard ausgewertet. Kein klassisches DMS-Archiv, sondern ein
modernes, dockerisiertes Analyse-Cockpit.

> Das gesamte UI/UX folgt dem in `DESIGN.md` dokumentierten Designsystem:
> warmes Cream-Canvas, IBM Plex Sans, flache Karten mit Haarlinien-Rand, ein
> einziges gelb-oranges Primär-CTA, 6px-Radius-Vokabular.

## Stack

| Bereich | Technologie |
|---|---|
| Framework | Next.js 15 (App Router) + TypeScript |
| UI | TailwindCSS + shadcn/ui-Primitives + Recharts |
| Datenbank | PostgreSQL + Prisma ORM |
| Queue / Worker | Redis + BullMQ |
| OCR | pdf-parse (Textlayer) + Tesseract.js (Scan-Fallback) |
| AI | OpenAI `gpt-4.1-mini` (strukturierte JSON-Extraktion) |
| Betrieb | Docker + Docker Compose (production-ready) |

## Schnellstart (Docker)

```bash
cp .env.example .env          # OPENAI_API_KEY eintragen
docker compose up --build
```

Das startet:

- **postgres** + **redis**
- **migrate** – wendet Prisma-Migrationen an und seeded Demo-Daten (einmalig)
- **web** – Next.js auf http://localhost:3000
- **worker** – BullMQ-Pipeline (Register → OCR → AI → Persistenz)
- **watcher** – überwacht `/data/inbox` auf neue PDFs

PDFs in das `inbox`-Volume legen (lokaler Ordner oder per **rclone** gemountetes
Google Drive), oder im UI unter **Rechnungen → Dokumente importieren** hochladen.

## Lokale Entwicklung

```bash
npm install
docker compose up -d postgres redis
export DATABASE_URL="postgresql://cockpit:cockpit@localhost:5432/cockpit?schema=public"
export REDIS_URL="redis://localhost:6379"
npx prisma migrate dev
npx tsx prisma/seed.ts
npm run dev          # Web
npm run worker       # in zweitem Terminal
npm run watcher      # in drittem Terminal (optional)
```

## Features

1. **Import** – Folder-Watcher (chokidar), Upload-API, manueller Ordner-Scan,
   BullMQ-Kolonne, Deduplikation per SHA-256-Checksum, Status
   `pending → processing → completed | needs_review | failed`.
2. **OCR** – Textlayer-Extraktion (pdf-parse); Scan-Fallback via Tesseract.
3. **AI-Extraktion** – Vendor, Adresse, Rechnungsnr./-datum, Netto/MwSt/Brutto,
   Währung, Dokumenttyp, deutsche semantische Tags, Confidence (per Feld).
   Geschäftsregel: *LTS Logistik ist immer Kunde, nie Lieferant.*
4. **Dashboard** – KPI-Cards, Kostentrend (Area), Top-Lieferanten (Bar),
   Kosten pro Tag (Pie), pro Kalenderwoche (Bar), Tag×Monat-Heatmap, größte &
   wiederkehrende Rechnungen.
5. **Rechnungen** – filter-/durchsuchbare Tabelle, PDF- & OCR-Vorschau,
   AI-Metadaten, Tags.
6. **AI Review** – Konfidenzschwelle, Review-Queue, manuelle Feldkorrektur,
   unveränderlicher Audit-Log, **AI Correction Memory** (gelernte Korrekturen
   pro Lieferant fließen in künftige Extraktionen ein).
7. **AI Chat** – natürlichsprachliche Analyse über die Kostendaten.

Details zur Architektur: siehe [`ARCHITECTURE.md`](./ARCHITECTURE.md).
