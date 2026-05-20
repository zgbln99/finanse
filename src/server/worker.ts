import { Worker } from "bullmq";
import { redis } from "../lib/redis";
import { INGEST_QUEUE, type IngestJobData } from "../lib/queue";
import { registerDocument, processDocument } from "../lib/process";

console.log(`[worker] starting, queue=${INGEST_QUEUE}`);

const worker = new Worker<IngestJobData>(
  INGEST_QUEUE,
  async (job) => {
    const { filePath, originalName, source } = job.data;
    console.log(`[worker] job ${job.id}: ${originalName}`);

    const { document, duplicate } = await registerDocument({ filePath, originalName, source });
    // Skip only documents that are already finished. Re-run ones that never
    // completed (failed / stuck) so a code fix retries them on the next sync.
    const finished = document.status === "completed" || document.status === "needs_review";
    if (duplicate && finished) {
      console.log(`[worker] duplicate skipped: ${originalName} -> ${document.id}`);
      return { documentId: document.id, duplicate: true };
    }

    await processDocument(document.id);
    return { documentId: document.id, duplicate: false, reprocessed: duplicate };
  },
  {
    connection: redis,
    concurrency: Number(process.env.WORKER_CONCURRENCY ?? "3"),
  },
);

worker.on("completed", (job, result) => {
  console.log(`[worker] completed ${job.id}`, result);
});
worker.on("failed", (job, err) => {
  console.error(`[worker] failed ${job?.id}:`, err.message);
});

async function shutdown() {
  console.log("[worker] shutting down");
  await worker.close();
  process.exit(0);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
