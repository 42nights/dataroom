PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  mime TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  content_hash TEXT NOT NULL UNIQUE,
  storage_path TEXT NOT NULL,
  status TEXT NOT NULL,
  parser_used TEXT,
  prompt_version TEXT,
  parsed_markdown_preview TEXT,
  chunk_count INTEGER,
  error_message TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);

CREATE TABLE IF NOT EXISTS chunks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  text TEXT NOT NULL,
  token_count INTEGER,
  embedding BLOB,
  UNIQUE(document_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_chunks_document ON chunks(document_id);

CREATE TABLE IF NOT EXISTS threads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  thread_id INTEGER NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  status TEXT NOT NULL,
  answerable INTEGER,
  confidence TEXT,
  citations_json TEXT,
  followups_json TEXT,
  prompt_version TEXT,
  error_message TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(thread_id, created_at);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  metadata_json TEXT,
  ts INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_ts ON audit_log(ts);

-- Compliance addendum (v0.2) -------------------------------------------------

CREATE TABLE IF NOT EXISTS document_compliance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  labels_json TEXT NOT NULL,            -- JSON array: ["phi","pii"]
  highest_severity TEXT NOT NULL,       -- 'block' | 'warn' | 'clean'
  findings_json TEXT NOT NULL,          -- detailed per-finding records
  regex_pass_version TEXT NOT NULL,
  llm_pass_version TEXT,                 -- null if LLM pass was skipped
  llm_pass_model TEXT,
  scanned_at INTEGER NOT NULL,
  UNIQUE(document_id, regex_pass_version, llm_pass_version)
);

CREATE INDEX IF NOT EXISTS idx_dc_doc ON document_compliance(document_id);
CREATE INDEX IF NOT EXISTS idx_dc_sev ON document_compliance(highest_severity);

-- LLM-pass result cache, keyed by content so an unchanged doc never re-pays
-- for the semantic pass (even across documents that share identical content).
CREATE TABLE IF NOT EXISTS compliance_llm_cache (
  content_hash TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  model TEXT NOT NULL,
  findings_json TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (content_hash, prompt_version, model)
);

-- chunks.compliance_labels_json / compliance_severity are added by migrate.ts
-- via ALTER TABLE (SQLite has no idempotent ADD COLUMN inside this file).
