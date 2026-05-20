import path from "node:path";
import chokidar from "chokidar";
import { enqueueIngest } from "../lib/queue";

const INGEST_DIR = process.env.INGEST_DIR ?? "/data/inbox";

console.log(`[watcher] watching ${INGEST_DIR} for PDFs`);

const watcher = chokidar.watch(INGEST_DIR, {
  persistent: true,
  ignoreInitial: false,
  awaitWriteFinish: { stabilityThreshold: 2_000, pollInterval: 200 },
  depth: 5,
});

function isPdf(p: string) {
  return p.toLowerCase().endsWith(".pdf");
}

watcher.on("add", async (filePath) => {
  if (!isPdf(filePath)) return;
  try {
    const job = await enqueueIngest({
      filePath,
      originalName: path.basename(filePath),
      source: INGEST_DIR.includes("drive") ? "drive" : "folder",
    });
    console.log(`[watcher] enqueued ${path.basename(filePath)} (job ${job.id})`);
  } catch (err) {
    console.error(`[watcher] failed to enqueue ${filePath}:`, (err as Error).message);
  }
});

watcher.on("error", (err) => console.error("[watcher] error:", err));

async function shutdown() {
  await watcher.close();
  process.exit(0);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
