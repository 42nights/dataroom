import { createHash } from "node:crypto";

export function sha256OfBuffer(buf: Buffer | Uint8Array): string {
  return createHash("sha256").update(buf).digest("hex");
}

export async function contentHashFromBlob(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buf);
  const bytes = new Uint8Array(digest);
  let hex = "";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");
  return hex;
}
