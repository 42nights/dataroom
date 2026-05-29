import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { db } from "./index";

function here(): string {
  if (typeof __dirname === "string") return __dirname;
  // ESM fallback
  return path.dirname(fileURLToPath((import.meta as { url: string }).url));
}

const SCHEMA_PATH = path.join(here(), "schema.sql");

function addColumnIfMissing(table: string, column: string, ddl: string) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{
    name: string;
  }>;
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
  }
}

export function runMigrations() {
  const sql = fs.readFileSync(SCHEMA_PATH, "utf8");
  db.exec(sql);

  // Compliance addendum: chunk-level labels inherited from / specialized
  // beyond their parent doc. Done here (not in schema.sql) so re-running is
  // idempotent against an existing chunks table.
  addColumnIfMissing("chunks", "compliance_labels_json", "TEXT");
  addColumnIfMissing("chunks", "compliance_severity", "TEXT");
}
