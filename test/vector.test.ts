import { describe, it, expect, beforeAll } from "vitest";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";

// Use a temp DB so this test doesn't touch ./data/.
// chdir must happen before ANY import of lib/db. Vitest tip: this file's
// top-level runs before the test functions, but ESM hoists static imports,
// so we set cwd via the env var that lib/db respects. Easier: dynamic import
// inside beforeAll.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "dataroom-test-"));
process.chdir(tmp);

let ensureSchema: typeof import("../lib/db/ensure").ensureSchema;
let db: typeof import("../lib/db/index").db;
let insertChunk: typeof import("../lib/vector").insertChunk;
let deleteChunksForDocument: typeof import("../lib/vector").deleteChunksForDocument;
let searchByVector: typeof import("../lib/vector").searchByVector;
let getIndex: typeof import("../lib/vector").getIndex;
let normalize: typeof import("../lib/embeddings").normalize;

function vec(values: number[]): Float32Array {
  const v = new Float32Array(1536);
  for (let i = 0; i < Math.min(values.length, 1536); i++) v[i] = values[i];
  return normalize(v);
}

beforeAll(async () => {
  ({ ensureSchema } = await import("../lib/db/ensure"));
  ({ db } = await import("../lib/db/index"));
  ({ insertChunk, deleteChunksForDocument, searchByVector, getIndex } =
    await import("../lib/vector"));
  ({ normalize } = await import("../lib/embeddings"));

  ensureSchema();
  db.exec(`DELETE FROM chunks; DELETE FROM documents;`);
  db.prepare(
    `INSERT INTO documents
     (id, title, original_filename, mime, size_bytes, content_hash,
      storage_path, status, created_at, updated_at)
     VALUES (1, 'Doc A', 'a.txt', 'text/plain', 5, 'hashA', '/tmp/a', 'ready', 0, 0)`,
  ).run();
  db.prepare(
    `INSERT INTO documents
     (id, title, original_filename, mime, size_bytes, content_hash,
      storage_path, status, created_at, updated_at)
     VALUES (2, 'Doc B', 'b.txt', 'text/plain', 5, 'hashB', '/tmp/b', 'ready', 0, 0)`,
  ).run();
});

describe("vector index", () => {
  it("inserts and searches via dot product", () => {
    const east = vec([1, 0, 0]);
    const north = vec([0, 1, 0]);
    insertChunk({
      documentId: 1,
      chunkIndex: 0,
      text: "facing east",
      embedding: east,
    });
    insertChunk({
      documentId: 2,
      chunkIndex: 0,
      text: "facing north",
      embedding: north,
    });

    const query = vec([0.9, 0.1, 0]);
    const hits = searchByVector(query, { limit: 2 });
    expect(hits.length).toBe(2);
    expect(hits[0].documentId).toBe(1);
    expect(hits[0].score).toBeGreaterThan(hits[1].score);
  });

  it("delete removes from both DB and in-memory index", () => {
    const sizeBefore = getIndex().size;
    expect(sizeBefore).toBeGreaterThanOrEqual(2);
    deleteChunksForDocument(1);
    expect(getIndex().size).toBe(sizeBefore - 1);

    const row = db
      .prepare("SELECT COUNT(*) AS n FROM chunks WHERE document_id = 1")
      .get() as { n: number };
    expect(row.n).toBe(0);
  });
});
