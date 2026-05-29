import { db } from "./db";
import { embedOne, EMBED_DIM } from "./embeddings";

export type SearchHit = {
  chunkId: number;
  documentId: number;
  chunkIndex: number;
  text: string;
  score: number;
  title: string;
};

declare global {
  // eslint-disable-next-line no-var
  var __dataroom_index: Map<number, Float32Array> | undefined;
}

function hydrate(): Map<number, Float32Array> {
  const m = new Map<number, Float32Array>();
  const rows = db
    .prepare(
      "SELECT id, embedding FROM chunks WHERE embedding IS NOT NULL",
    )
    .all() as { id: number; embedding: Buffer }[];
  for (const r of rows) m.set(r.id, bufToVec(r.embedding));
  return m;
}

export function getIndex(): Map<number, Float32Array> {
  if (!globalThis.__dataroom_index) {
    globalThis.__dataroom_index = hydrate();
  }
  return globalThis.__dataroom_index;
}

function bufToVec(b: Buffer): Float32Array {
  // Copy so the SQLite buffer isn't reused under us.
  const f = new Float32Array(EMBED_DIM);
  const view = new Float32Array(b.buffer, b.byteOffset, EMBED_DIM);
  f.set(view);
  return f;
}

function vecToBuf(v: Float32Array): Buffer {
  return Buffer.from(v.buffer, v.byteOffset, v.byteLength);
}

export function insertChunk(args: {
  documentId: number;
  chunkIndex: number;
  text: string;
  embedding: Float32Array;
  tokenCount?: number;
  complianceLabels?: string[];
  complianceSeverity?: string;
}): number {
  const info = db
    .prepare(
      `INSERT INTO chunks
       (document_id, chunk_index, text, token_count, embedding,
        compliance_labels_json, compliance_severity)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      args.documentId,
      args.chunkIndex,
      args.text,
      args.tokenCount ?? null,
      vecToBuf(args.embedding),
      args.complianceLabels ? JSON.stringify(args.complianceLabels) : null,
      args.complianceSeverity ?? null,
    );
  const id = Number(info.lastInsertRowid);
  getIndex().set(id, args.embedding);
  return id;
}

export function deleteChunksForDocument(documentId: number) {
  const ids = db
    .prepare("SELECT id FROM chunks WHERE document_id = ?")
    .all(documentId) as { id: number }[];
  db.prepare("DELETE FROM chunks WHERE document_id = ?").run(documentId);
  const idx = getIndex();
  for (const { id } of ids) idx.delete(id);
}

export async function search(
  query: string,
  opts: { limit?: number; minScore?: number } = {},
): Promise<SearchHit[]> {
  const limit = opts.limit ?? 8;
  const minScore = opts.minScore ?? 0;
  const qVec = await embedOne(query);
  return searchByVector(qVec, { limit, minScore });
}

export function searchByVector(
  qVec: Float32Array,
  opts: { limit?: number; minScore?: number } = {},
): SearchHit[] {
  const limit = opts.limit ?? 8;
  const minScore = opts.minScore ?? 0;
  const idx = getIndex();

  const scored: { id: number; score: number }[] = [];
  for (const [id, v] of idx) {
    let s = 0;
    for (let i = 0; i < v.length; i++) s += qVec[i] * v[i];
    if (s >= minScore) scored.push({ id, score: s });
  }
  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, limit);
  if (top.length === 0) return [];

  const stmt = db.prepare(
    `SELECT c.id, c.document_id, c.chunk_index, c.text, d.title
     FROM chunks c JOIN documents d ON d.id = c.document_id
     WHERE c.id = ?`,
  );
  return top.map(({ id, score }) => {
    const row = stmt.get(id) as {
      id: number;
      document_id: number;
      chunk_index: number;
      text: string;
      title: string;
    };
    return {
      chunkId: row.id,
      documentId: row.document_id,
      chunkIndex: row.chunk_index,
      text: row.text,
      title: row.title,
      score,
    };
  });
}

export function getChunkWithContext(
  documentId: number,
  chunkIndex: number,
  before = 1,
  after = 1,
): Array<{ chunk_index: number; text: string }> {
  return db
    .prepare(
      `SELECT chunk_index, text FROM chunks
       WHERE document_id = ?
         AND chunk_index BETWEEN ? AND ?
       ORDER BY chunk_index`,
    )
    .all(documentId, chunkIndex - before, chunkIndex + after) as Array<{
    chunk_index: number;
    text: string;
  }>;
}

export function listChunksForDocument(
  documentId: number,
): Array<{ chunk_index: number; text: string }> {
  return db
    .prepare(
      `SELECT chunk_index, text FROM chunks WHERE document_id = ? ORDER BY chunk_index`,
    )
    .all(documentId) as Array<{ chunk_index: number; text: string }>;
}
