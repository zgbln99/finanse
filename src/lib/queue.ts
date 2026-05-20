import { Queue } from "bullmq";
import { redis } from "./redis";

export const INGEST_QUEUE = "invoice-ingest";

export type IngestJobData = {
  /** Absolute path to the PDF on disk (inside the shared volume). */
  filePath: string;
  source: "folder" | "drive" | "upload";
  originalName: string;
};

let queue: Queue<IngestJobData> | undefined;

export function getIngestQueue(): Queue<IngestJobData> {
  if (!queue) {
    queue = new Queue<IngestJobData>(INGEST_QUEUE, {
      connection: redis,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 5_000 },
        removeOnComplete: { age: 86_400, count: 1_000 },
        removeOnFail: { age: 604_800 },
      },
    });
  }
  return queue;
}

export async function enqueueIngest(data: IngestJobData) {
  return getIngestQueue().add("ingest", data, {
    // Dedup at queue level by path; checksum dedup happens in the worker.
    jobId: `ingest-${Buffer.from(data.filePath).toString("base64url")}`,
  });
}
