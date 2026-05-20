import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

/** SHA-256 of file bytes — the deduplication key for imported documents. */
export async function fileChecksum(path: string): Promise<string> {
  const buf = await readFile(path);
  return createHash("sha256").update(buf).digest("hex");
}

export function bufferChecksum(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}
