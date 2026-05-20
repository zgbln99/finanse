# Architecture Overview

## Design principles

- **AI-first** — every imported document flows through an AI enrichment
  pipeline; manual work is the exception (review), not the rule.
- **Modular** — clear separation between ingestion, processing, persistence,
  presentation, and analysis. Each concern lives in its own module/service.
- **Scalable** — stateless web tier + horizontally scalable workers behind a
  Redis-backed BullMQ queue. Concurrency is configurable per worker.
- **Self-hosted & dockerized** — Postgres, Redis, web, worker, and watcher run
  as independent containers via Docker Compose.

## Container topology

```
                       ┌──────────────┐
   PDFs (folder /      │   watcher    │  chokidar watches INGEST_DIR
   rclone Google Drive)│ (Dockerfile. │──┐ enqueues ingest jobs
                       │   worker)    │  │
                       └──────────────┘  │
                                         ▼
   ┌───────────┐   enqueue        ┌──────────────┐    ┌──────────────┐
   │    web    │ ───────────────▶ │    redis     │◀───│    worker    │
   │ (Next.js  │   BullMQ          │  (BullMQ)    │    │  BullMQ      │
   │  App      │ ◀──────────────── └──────────────┘    │  consumer    │
   │  Router)  │                                       └──────┬───────┘
   └─────┬─────┘                                              │
         │                  ┌──────────────┐                  │
         └─────────────────▶│  postgres    │◀─────────────────┘
            Prisma queries   │  (Prisma)    │   register + persist
                             └──────────────┘
                                    ▲
                             OpenAI gpt-4.1-mini (extraction + chat)
```

Shared Docker volumes:
- `ingest` → `/data/inbox` (watcher + web upload + worker read)
- `storage` → `/data/storage` (deduplicated, checksum-named PDFs)

## Ingestion → processing pipeline

`src/server/watcher.ts` and the upload API (`POST /api/invoices`) both enqueue
an `ingest` job (`src/lib/queue.ts`). The worker (`src/server/worker.ts`) runs
`src/lib/process.ts`:

1. **registerDocument** — SHA-256 checksum (`src/lib/checksum.ts`) →
   dedup against `Document.checksum`; creates a `pending` row + audit entry.
2. **OCR** (`src/lib/ocr.ts`) — pdf-parse text layer first; Tesseract fallback
   for scanned PDFs when a canvas renderer is available.
3. **Move to storage** — file renamed to `<checksum>.pdf` under `STORAGE_DIR`.
4. **AI extraction** (`src/lib/extraction.ts`) — OpenAI structured JSON output
   (strict `json_schema`), German accounting terminology, business-rule guard
   (LTS Logistik never a vendor), tag normalization.
5. **Correction memory** — learned per-vendor corrections applied
   (`CorrectionMemory`).
6. **Persist** — vendor upsert, document fields, tag sync, audit log.
7. **Routing** — confidence ≥ `AI_CONFIDENCE_THRESHOLD` → `completed`,
   otherwise → `needs_review`. Errors → `failed` with message.

Job options: 3 attempts, exponential backoff, queue-level dedup by file path.

## Data model (`prisma/schema.prisma`)

- **Document** — lifecycle (status), OCR (`ocrText`, `ocrEngine`), AI fields
  (vendor, address, amounts, currency, type), AI meta (`confidence`,
  `fieldConfidence`, `isRecurring`, `reviewed`), relations to tags/audit.
- **Vendor** — deduplicated via `normalized` key (`normalizeVendor`).
- **Tag** / **DocumentTag** — short German semantic tags with `source`
  (`ai` | `manual`).
- **AuditLog** — immutable trail (created, ocr, extracted, field_corrected,
  status_changed, reviewed…).
- **CorrectionMemory** — `(vendorKey, field, fromValue) → toValue` with hit
  count; the AI-correction feedback loop.

## Presentation tier (App Router)

- `/` Dashboard — server component → `src/lib/analytics.ts` aggregations →
  KPI cards, Recharts area/bar/pie + custom heatmap.
- `/invoices` — client table with debounced search + status/type filters;
  import panel (upload / folder scan).
- `/invoices/[id]` — PDF + OCR preview, editable AI metadata, tag editor,
  audit log. Saves via `PATCH` → audit + correction memory.
- `/review` — confidence-sorted review queue + failed documents.
- `/chat` — AI analyst over a compact, factual data brief built from the DB.

## API surface (`src/app/api`)

| Route | Method | Purpose |
|---|---|---|
| `/api/dashboard/stats` | GET | Dashboard aggregations |
| `/api/invoices` | GET | Filter/search/paginate |
| `/api/invoices` | POST | Multipart PDF upload → enqueue |
| `/api/invoices/[id]` | GET | Detail incl. audit log |
| `/api/invoices/[id]` | PATCH | Manual correction, audit, correction memory |
| `/api/invoices/[id]/file` | GET | Stream stored PDF |
| `/api/import/scan` | POST | Scan inbox folder, enqueue PDFs |
| `/api/chat` | POST | AI analysis over cost data |

## Design system

`DESIGN.md` tokens are encoded in `tailwind.config.ts` (cream canvas, olive ink,
single yellow-orange primary, hairline borders, 4–8px radii) and applied via
`src/app/globals.css` and the shadcn-style primitives in `src/components/ui`.
No drop shadows, no second saturated color — flat cards on a continuous cream
sheet, exactly as specified.

## Scaling notes

- Workers scale horizontally: `docker compose up --scale worker=N`.
- `WORKER_CONCURRENCY` tunes per-worker parallelism.
- Web tier is stateless and can sit behind any load balancer.
- Postgres indices cover status, vendor, invoiceDate, and document type for the
  dashboard/list query paths.
