import { db } from "../db";
import { COMPLIANCE_MODEL } from "../constants";
import { regexComplianceScan, REGEX_PASS_VERSION } from "./regex";
import { llmComplianceScan, COMPLIANCE_PROMPT_VERSION } from "./llm";
import {
  highestSeverity,
  type ChunkCompliance,
  type ComplianceLabel,
  type DocumentComplianceRow,
  type Finding,
  type Severity,
} from "./types";

export * from "./types";
export { REGEX_PASS_VERSION, regexComplianceScan } from "./regex";
export {
  COMPLIANCE_PROMPT_VERSION,
  llmComplianceScan,
  ComplianceFindingsSchema,
} from "./llm";

function uniq<T>(xs: T[]): T[] {
  return Array.from(new Set(xs));
}

export type ComplianceResult = {
  labels: ComplianceLabel[];
  severity: Severity;
  findings: Finding[];
  /** per-chunk labels/severity, aligned to chunk index */
  chunkCompliance: ChunkCompliance[];
  llmRan: boolean;
};

/**
 * Run the full compliance pass for one document and persist a
 * `document_compliance` row. Returns doc-level labels/severity plus per-chunk
 * compliance for the caller to write onto each chunk row.
 *
 * Chunks inherit the document's labels and severity (the conservative default
 * the access-tier layer relies on — see texting_agent_access_tiers.md).
 */
export async function runCompliancePass(args: {
  documentId: number;
  contentHash: string;
  scrubbed: string;
  chunkTexts: string[];
}): Promise<ComplianceResult> {
  const { documentId, contentHash, scrubbed, chunkTexts } = args;

  const regexFindings = regexComplianceScan(scrubbed);
  const llmFindings = await llmComplianceScan(scrubbed, { contentHash });
  const llmRan = Boolean(process.env.ANTHROPIC_API_KEY);

  const findings = [...regexFindings, ...llmFindings];
  const labels = uniq(findings.map((f) => f.label)) as ComplianceLabel[];
  const severity = highestSeverity(findings);
  const docLabels: ComplianceLabel[] = labels.length ? labels : ["clean"];

  const now = Date.now();
  const tx = db.transaction(() => {
    db.prepare(`DELETE FROM document_compliance WHERE document_id = ?`).run(
      documentId,
    );
    db.prepare(
      `INSERT INTO document_compliance
       (document_id, labels_json, highest_severity, findings_json,
        regex_pass_version, llm_pass_version, llm_pass_model, scanned_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      documentId,
      JSON.stringify(docLabels),
      severity,
      JSON.stringify(findings),
      REGEX_PASS_VERSION,
      llmRan ? COMPLIANCE_PROMPT_VERSION : null,
      llmRan ? COMPLIANCE_MODEL : null,
      now,
    );
  });
  tx();

  const chunkCompliance: ChunkCompliance[] = chunkTexts.map(() => ({
    labels: docLabels,
    severity,
  }));

  return { labels: docLabels, severity, findings, chunkCompliance, llmRan };
}

export function getDocumentCompliance(
  documentId: number,
): DocumentComplianceRow | null {
  return (
    (db
      .prepare(
        `SELECT * FROM document_compliance WHERE document_id = ?
         ORDER BY scanned_at DESC LIMIT 1`,
      )
      .get(documentId) as DocumentComplianceRow | undefined) ?? null
  );
}

export type ComplianceSummary = {
  total_documents: number;
  scanned_documents: number;
  by_severity: Record<Severity, number>;
  by_label: Record<string, number>;
  top_offenders: Array<{
    document_id: number;
    title: string;
    severity: Severity;
    labels: ComplianceLabel[];
  }>;
  last_full_scan_at: number | null;
};

const SEVERITY_RANK: Record<Severity, number> = { clean: 0, warn: 1, block: 2 };

export function complianceSummary(): ComplianceSummary {
  const totalDocuments = (
    db.prepare(`SELECT COUNT(*) AS n FROM documents`).get() as { n: number }
  ).n;

  const rows = db
    .prepare(
      `SELECT dc.document_id, dc.labels_json, dc.highest_severity,
              dc.scanned_at, d.title
       FROM document_compliance dc
       JOIN documents d ON d.id = dc.document_id`,
    )
    .all() as Array<{
    document_id: number;
    labels_json: string;
    highest_severity: Severity;
    scanned_at: number;
    title: string;
  }>;

  const bySeverity: Record<Severity, number> = { clean: 0, warn: 0, block: 0 };
  const byLabel: Record<string, number> = {};
  let lastScan: number | null = null;

  for (const r of rows) {
    bySeverity[r.highest_severity] = (bySeverity[r.highest_severity] ?? 0) + 1;
    const labels = JSON.parse(r.labels_json) as ComplianceLabel[];
    for (const l of labels) {
      if (l === "clean") continue;
      byLabel[l] = (byLabel[l] ?? 0) + 1;
    }
    if (lastScan === null || r.scanned_at > lastScan) lastScan = r.scanned_at;
  }

  const topOffenders = rows
    .filter((r) => r.highest_severity !== "clean")
    .sort(
      (a, b) =>
        SEVERITY_RANK[b.highest_severity] - SEVERITY_RANK[a.highest_severity] ||
        b.scanned_at - a.scanned_at,
    )
    .slice(0, 10)
    .map((r) => ({
      document_id: r.document_id,
      title: r.title,
      severity: r.highest_severity,
      labels: JSON.parse(r.labels_json) as ComplianceLabel[],
    }));

  return {
    total_documents: totalDocuments,
    scanned_documents: rows.length,
    by_severity: bySeverity,
    by_label: byLabel,
    top_offenders: topOffenders,
    last_full_scan_at: lastScan,
  };
}

/**
 * Re-run regex + LLM passes for a single already-ingested document, reading
 * its scrubbed text from the stored chunks. Used by the rescan endpoints and
 * the audit script (so they don't need the original bytes on disk).
 */
export async function rescanDocument(
  documentId: number,
): Promise<ComplianceResult | null> {
  const doc = db
    .prepare(`SELECT content_hash FROM documents WHERE id = ?`)
    .get(documentId) as { content_hash: string } | undefined;
  if (!doc) return null;

  const chunkRows = db
    .prepare(
      `SELECT chunk_index, text FROM chunks WHERE document_id = ? ORDER BY chunk_index`,
    )
    .all(documentId) as Array<{ chunk_index: number; text: string }>;

  const chunkTexts = chunkRows.map((c) => c.text);
  const scrubbed = chunkTexts.join("\n\n");

  const result = await runCompliancePass({
    documentId,
    contentHash: doc.content_hash,
    scrubbed,
    chunkTexts,
  });

  const update = db.prepare(
    `UPDATE chunks SET compliance_labels_json = ?, compliance_severity = ?
     WHERE document_id = ? AND chunk_index = ?`,
  );
  const tx = db.transaction(() => {
    chunkRows.forEach((c, i) => {
      const cc = result.chunkCompliance[i];
      update.run(
        JSON.stringify(cc.labels),
        cc.severity,
        documentId,
        c.chunk_index,
      );
    });
  });
  tx();

  return result;
}
