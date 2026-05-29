export type ComplianceLabel =
  | "phi"
  | "pii"
  | "pci"
  | "financial"
  | "secrets"
  | "legal-confidential"
  | "clean";

export type Severity = "block" | "warn" | "clean";
export type FindingSeverity = "block" | "warn";

export type Finding = {
  detector: string; // 'mrn' | 'ssn' | 'llm-semantic' | ...
  label: Exclude<ComplianceLabel, "clean">;
  severity: FindingSeverity;
  chunkIndex?: number; // undefined if doc-level
  startOffset?: number;
  endOffset?: number;
  snippet: string; // ~80 chars of redacted context for the report
  rationale?: string; // LLM-only — why it flagged this
};

export type ChunkCompliance = {
  labels: ComplianceLabel[];
  severity: Severity;
};

export type DocumentComplianceRow = {
  id: number;
  document_id: number;
  labels_json: string;
  highest_severity: Severity;
  findings_json: string;
  regex_pass_version: string;
  llm_pass_version: string | null;
  llm_pass_model: string | null;
  scanned_at: number;
};

export function highestSeverity(findings: Finding[]): Severity {
  if (findings.some((f) => f.severity === "block")) return "block";
  if (findings.length > 0) return "warn";
  return "clean";
}
