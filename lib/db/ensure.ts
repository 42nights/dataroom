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
  const row = db
    .prepare(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='documents'`,
    )
    .get();
  if (!row) runMigrations();
  ensured = true;
}
