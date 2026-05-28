import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const DATA_DIR = path.resolve(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "dataroom.db");
const FILES_DIR = path.join(DATA_DIR, "files");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(FILES_DIR)) fs.mkdirSync(FILES_DIR, { recursive: true });

declare global {
  // eslint-disable-next-line no-var
  var __dataroom_db: Database.Database | undefined;
}

function openDb(): Database.Database {
  const d = new Database(DB_PATH);
  d.pragma("journal_mode = WAL");
  d.pragma("foreign_keys = ON");
  return d;
}

export const db: Database.Database = globalThis.__dataroom_db ?? openDb();
if (!globalThis.__dataroom_db) globalThis.__dataroom_db = db;

export const PATHS = {
  DATA_DIR,
  FILES_DIR,
  DB_PATH,
};
