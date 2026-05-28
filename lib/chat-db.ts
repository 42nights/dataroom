import { db } from "./db";

export type ThreadRow = {
  id: number;
  title: string;
  created_at: number;
  updated_at: number;
};

export type MessageRow = {
  id: number;
  thread_id: number;
  role: "user" | "assistant" | "system";
  content: string;
  status: "pending" | "streaming" | "complete" | "error";
  answerable: number | null;
  confidence: string | null;
  citations_json: string | null;
  followups_json: string | null;
  prompt_version: string | null;
  error_message: string | null;
  created_at: number;
};

export type ParsedMessage = Omit<
  MessageRow,
  "citations_json" | "followups_json" | "answerable"
> & {
  answerable: boolean | null;
  citations: any[];
  followups: string[];
};

export function createThread(title: string): number {
  const now = Date.now();
  const info = db
    .prepare(
      `INSERT INTO threads (title, created_at, updated_at) VALUES (?, ?, ?)`,
    )
    .run(title || "New chat", now, now);
  return Number(info.lastInsertRowid);
}

export function listThreads(): ThreadRow[] {
  return db
    .prepare(`SELECT * FROM threads ORDER BY updated_at DESC LIMIT 100`)
    .all() as ThreadRow[];
}

export function getThread(id: number): ThreadRow | null {
  return (
    (db.prepare(`SELECT * FROM threads WHERE id = ?`).get(id) as
      | ThreadRow
      | undefined) ?? null
  );
}

export function renameThread(id: number, title: string) {
  db.prepare(`UPDATE threads SET title=?, updated_at=? WHERE id=?`).run(
    title,
    Date.now(),
    id,
  );
}

export function deleteThread(id: number) {
  db.prepare(`DELETE FROM threads WHERE id = ?`).run(id);
}

export function touchThread(id: number, maybeTitle?: string) {
  if (maybeTitle) {
    db.prepare(`UPDATE threads SET title=?, updated_at=? WHERE id=?`).run(
      maybeTitle,
      Date.now(),
      id,
    );
  } else {
    db.prepare(`UPDATE threads SET updated_at=? WHERE id=?`).run(
      Date.now(),
      id,
    );
  }
}

export function appendMessage(args: {
  threadId: number;
  role: MessageRow["role"];
  content: string;
  status: MessageRow["status"];
  answerable?: boolean | null;
  confidence?: string | null;
  citations?: unknown;
  followups?: string[];
  promptVersion?: string;
  errorMessage?: string | null;
}): number {
  const info = db
    .prepare(
      `INSERT INTO messages
       (thread_id, role, content, status, answerable, confidence,
        citations_json, followups_json, prompt_version, error_message, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      args.threadId,
      args.role,
      args.content,
      args.status,
      args.answerable == null ? null : args.answerable ? 1 : 0,
      args.confidence ?? null,
      args.citations ? JSON.stringify(args.citations) : null,
      args.followups ? JSON.stringify(args.followups) : null,
      args.promptVersion ?? null,
      args.errorMessage ?? null,
      Date.now(),
    );
  return Number(info.lastInsertRowid);
}

export function getMessages(threadId: number): ParsedMessage[] {
  const rows = db
    .prepare(
      `SELECT * FROM messages WHERE thread_id = ? ORDER BY created_at ASC`,
    )
    .all(threadId) as MessageRow[];
  return rows.map(parseMessage);
}

export function getRecentHistory(
  threadId: number,
  limit: number,
): Array<{ role: "user" | "assistant"; content: string }> {
  const rows = db
    .prepare(
      `SELECT role, content FROM messages
       WHERE thread_id = ? AND status = 'complete' AND role IN ('user','assistant')
       ORDER BY created_at DESC
       LIMIT ?`,
    )
    .all(threadId, limit) as Array<{
    role: "user" | "assistant";
    content: string;
  }>;
  return rows.reverse();
}

function parseMessage(r: MessageRow): ParsedMessage {
  return {
    id: r.id,
    thread_id: r.thread_id,
    role: r.role,
    content: r.content,
    status: r.status,
    answerable: r.answerable == null ? null : r.answerable === 1,
    confidence: r.confidence,
    citations: r.citations_json ? JSON.parse(r.citations_json) : [],
    followups: r.followups_json ? JSON.parse(r.followups_json) : [],
    prompt_version: r.prompt_version,
    error_message: r.error_message,
    created_at: r.created_at,
  };
}
