import { db } from "./index";
import { runMigrations } from "./migrate";

let ensured = false;

/**
 * Call from every API route entry point. Idempotent. Runs schema migrations
 * if the `documents` table doesn't exist yet, so a fresh checkout works with
 * just `npm run dev` (no separate migrate step needed).
 */
export function ensureSchema() {
  if (ensured) return;
  const tables = db
    .prepare(
      `SELECT name FROM sqlite_master
       WHERE type='table' AND name IN ('documents','document_compliance')`,
    )
    .all() as Array<{ name: string }>;
  const names = new Set(tables.map((t) => t.name));
  // Run migrations on a fresh DB (no documents) or when an older DB predates
  // the compliance addendum. runMigrations is idempotent.
  if (!names.has("documents") || !names.has("document_compliance")) {
    runMigrations();
  }
  ensured = true;
}
