import fs from "node:fs/promises";
import { ensureSchema } from "../lib/db/ensure";
import { db } from "../lib/db/index";
import { ingestFile } from "../lib/ingest";
import { PROMPT_VERSION } from "../lib/prompts";

async function main() {
  ensureSchema();
  const rows = db
    .prepare(
      `SELECT id, storage_path, original_filename, mime, title
       FROM documents
       WHERE status = 'ready' AND (prompt_version IS NULL OR prompt_version != ?)`,
    )
    .all(PROMPT_VERSION) as Array<{
    id: number;
    storage_path: string;
    original_filename: string;
    mime: string;
    title: string;
  }>;

  // eslint-disable-next-line no-console
  console.log(`Re-ingesting ${rows.length} stale documents…`);
  for (const r of rows) {
    try {
      const bytes = await fs.readFile(r.storage_path);
      const result = await ingestFile({
        bytes,
        originalFilename: r.original_filename,
        mime: r.mime,
        title: r.title,
      });
      // eslint-disable-next-line no-console
      console.log(`  ${r.id} ${r.title}: ${result.ok ? "ok" : "error"}`);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`  ${r.id} ${r.title}: ${(err as Error).message}`);
    }
  }
}

main();
