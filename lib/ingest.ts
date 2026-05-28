import fs from "node:fs/promises";
import path from "node:path";
import { db, PATHS } from "./db";
import { embedBatch } from "./embeddings";
import { insertChunk, deleteChunksForDocument } from "./vector";
import { parseToMarkdown } from "./parsers";
import { scrubSecrets } from "./scrubber";
import { markdownChunker } from "./chunker";
import { sha256OfBuffer } from "./hash";
import { PROMPT_VERSION } from "./prompts";
import { audit } from "./audit";

export type IngestResult =
  | { ok: true; documentId: number; deduped: boolean }
  | { ok: false; error: string; documentId?: number };

const EMBED_BATCH = 96;

export async function ingestFile(args: {
  bytes: Buffer;
  originalFilename: string;
  mime: string;
  title?: string;
}): Promise<IngestResult> {
  const hash = sha256OfBuffer(args.bytes);

  const existing = db
    .prepare("SELECT id, status FROM documents WHERE content_hash = ?")
    .get(hash) as { id: number; status: string } | undefined;

  if (existing && existing.status === "ready") {
    return { ok: true, documentId: existing.id, deduped: true };
  }

  const ext = path.extname(args.originalFilename) || "";
  const storagePath = path.join(PATHS.FILES_DIR, `${hash}${ext}`);
  await fs.writeFile(storagePath, args.bytes);

  const now = Date.now();
  let docId: number;
  if (existing) {
    db.prepare(
      `UPDATE documents
       SET status='parsing', prompt_version=?, error_message=NULL, updated_at=?
       WHERE id=?`,
    ).run(PROMPT_VERSION, now, existing.id);
    deleteChunksForDocument(existing.id);
    docId = existing.id;
  } else {
    const info = db
      .prepare(
        `INSERT INTO documents
         (title, original_filename, mime, size_bytes, content_hash,
          storage_path, status, prompt_version, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 'parsing', ?, ?, ?)`,
      )
      .run(
        args.title ?? args.originalFilename,
        args.originalFilename,
        args.mime,
        args.bytes.length,
        hash,
        storagePath,
        PROMPT_VERSION,
        now,
        now,
      );
    docId = Number(info.lastInsertRowid);
  }

  audit("upload", "document", docId, {
    filename: args.originalFilename,
    sizeBytes: args.bytes.length,
    mime: args.mime,
  });

  try {
    const { markdown, parserUsed } = await parseToMarkdown(
      args.bytes,
      args.mime,
      args.originalFilename,
    );
    const { text: scrubbed, matches } = scrubSecrets(markdown);
    if (matches.length) {
      // eslint-disable-next-line no-console
      console.warn(
        `[ingest] redacted ${matches.length} secrets from ${args.originalFilename} (${matches.map((m) => m.kind).join(",")})`,
      );
    }
    const chunks = markdownChunker(scrubbed);
    if (!chunks.length) throw new Error("Chunker produced no chunks");

    db.prepare(
      `UPDATE documents
       SET status='embedding', parser_used=?, parsed_markdown_preview=?, updated_at=?
       WHERE id=?`,
    ).run(parserUsed, scrubbed.slice(0, 1000), Date.now(), docId);

    let cIdx = 0;
    for (let i = 0; i < chunks.length; i += EMBED_BATCH) {
      const batch = chunks.slice(i, i + EMBED_BATCH);
      const vectors = await embedBatch(batch.map((c) => c.text));
      const tx = db.transaction(() => {
        for (let j = 0; j < batch.length; j++) {
          insertChunk({
            documentId: docId,
            chunkIndex: cIdx,
            text: batch[j].text,
            embedding: vectors[j],
          });
          cIdx++;
        }
      });
      tx();
    }

    db.prepare(
      `UPDATE documents
       SET status='ready', chunk_count=?, updated_at=?
       WHERE id=?`,
    ).run(chunks.length, Date.now(), docId);

    return { ok: true, documentId: docId, deduped: false };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    db.prepare(
      `UPDATE documents SET status='error', error_message=?, updated_at=? WHERE id=?`,
    ).run(message, Date.now(), docId);
    return { ok: false, error: message, documentId: docId };
  }
}

export async function deleteDocument(documentId: number): Promise<void> {
  const row = db
    .prepare(`SELECT storage_path FROM documents WHERE id = ?`)
    .get(documentId) as { storage_path: string } | undefined;
  // Cascade deletes chunks via FK; manually drop the file too.
  db.prepare(`DELETE FROM documents WHERE id = ?`).run(documentId);
  deleteChunksForDocument(documentId); // also clears in-memory index entries
  if (row?.storage_path) {
    try {
      await fs.unlink(row.storage_path);
    } catch {
      // file already gone; fine
    }
  }
  audit("delete", "document", documentId);
}

export function renameDocument(documentId: number, title: string) {
  db.prepare(`UPDATE documents SET title=?, updated_at=? WHERE id=?`).run(
    title.trim(),
    Date.now(),
    documentId,
  );
  audit("rename", "document", documentId, { title });
}

export type DocumentRow = {
  id: number;
  title: string;
  original_filename: string;
  mime: string;
  size_bytes: number;
  content_hash: string;
  storage_path: string;
  status: string;
  parser_used: string | null;
  prompt_version: string | null;
  parsed_markdown_preview: string | null;
  chunk_count: number | null;
  error_message: string | null;
  created_at: number;
  updated_at: number;
};

export function listDocuments(): DocumentRow[] {
  return db
    .prepare(`SELECT * FROM documents ORDER BY created_at DESC`)
    .all() as DocumentRow[];
}

export function getDocument(id: number): DocumentRow | null {
  return (
    (db.prepare(`SELECT * FROM documents WHERE id = ?`).get(id) as
      | DocumentRow
      | undefined) ?? null
  );
}
