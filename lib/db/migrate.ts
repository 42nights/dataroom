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

export function runMigrations() {
  const sql = fs.readFileSync(SCHEMA_PATH, "utf8");
  db.exec(sql);
}
