import { db } from "./db";

export function audit(
  action: string,
  targetType: string,
  targetId: string | number,
  metadata?: Record<string, unknown>,
) {
  db.prepare(
    `INSERT INTO audit_log (action, target_type, target_id, metadata_json, ts)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(
    action,
    targetType,
    String(targetId),
    metadata ? JSON.stringify(metadata) : null,
    Date.now(),
  );
}

export function recentAuditLog(limit = 50) {
  return db
    .prepare(`SELECT * FROM audit_log ORDER BY ts DESC LIMIT ?`)
    .all(limit);
}
