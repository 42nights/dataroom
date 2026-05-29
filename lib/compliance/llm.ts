import "../local-mode";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { createHash } from "node:crypto";
import { db } from "../db";
import { COMPLIANCE_MODEL } from "../constants";
import type { Finding } from "./types";

export const COMPLIANCE_PROMPT_VERSION = "v5";

export const COMPLIANCE_PROMPT = `You audit documents for sensitive-data classification. The document has already passed a regex scan that catches SSNs, card numbers, MRNs, IBANs, routing numbers, etc. Your job is to catch only what regex CANNOT: sensitive data expressed in prose or context.

Use these labels with their STRICT definitions. Do not stretch them:
- "phi": health information tied to an identifiable individual (a named/identifiable person's diagnosis, condition, treatment, medical record). NOT generic mentions of health topics.
- "pii": an identifiable individual's personal data. This INCLUDES named individuals tied to a role or employer (e.g. "Jerry Xu, CTO of Helio" or "Daniel R., backend reviewer"), home addresses, DOB, personal phone/email, government IDs. If the document names real people, emit a pii finding — these labels gate who the downstream agent may surface the document to.
- "pci": payment-card data (card numbers, CVV) described in prose. Rare; regex usually catches this.
- "financial": financial ACCOUNT identifiers only — bank account numbers, routing numbers, IBAN, SWIFT/BIC. This label is NOT for prices, spend figures, budgets, burn rate, salaries, or vendor costs. Those are commercial-confidential, label them "legal-confidential" if anything.
- "legal-confidential": contracts (MSAs, SOWs), legal documents, anything explicitly marked privileged/confidential, and internal commercial-strategy material that should be access-restricted (negotiation playbooks, vendor pricing/spend, deal terms, internal strategy discussions about burn/runway/cost-cutting).

Severity — be strict:
- "block": ONLY for data that is directly dangerous if leaked — a real SSN/MRN/full card number, a bank/routing/account number, a government ID, or a document carrying an explicit "ATTORNEY-CLIENT PRIVILEGED" / "CONFIDENTIAL — LEGAL" marking. Live secrets count too.
- "warn": everything else worth surfacing — names, roles, commercial pricing, contract references, strategy. When unsure, use "warn", never "block".

Hard rules:
1. CONSOLIDATE. Emit at most ONE finding per label per document. If five names appear, that is ONE pii finding listing them, not five. If the doc is a confidential contract, that is ONE legal-confidential finding.
2. Return at most 3 findings total. Pick the most important.
3. Commercial sensitivity (pricing, burn, spend, negotiation) is NEVER "financial" and NEVER "block". At most legal-confidential / warn.
4. We would rather miss a borderline item than overflag a clean doc. If nothing meets the bar, return an empty findings array.

For each finding return: label, severity, snippet (the offending span, max 80 chars), rationale (one sentence).`;

// Lenient on string length on purpose: an over-long snippet/rationale from the
// model must not nuke the whole document's findings (it gets truncated in the
// mapping below instead). Unknown labels/severities ARE rejected per-item.
export const ComplianceFindingsSchema = z.object({
  findings: z
    .array(
      z.object({
        label: z.enum(["phi", "pii", "pci", "financial", "legal-confidential"]),
        severity: z.enum(["block", "warn"]),
        snippet: z.string(),
        rationale: z.string(),
      }),
    )
    .default([]),
});

export type ComplianceFindings = z.infer<typeof ComplianceFindingsSchema>;

const REPORT_TOOL = {
  name: "report_findings",
  description:
    "Report sensitive-data findings the regex scan missed. Call exactly once.",
  input_schema: {
    type: "object" as const,
    properties: {
      findings: {
        type: "array" as const,
        items: {
          type: "object" as const,
          properties: {
            label: {
              type: "string" as const,
              enum: ["phi", "pii", "pci", "financial", "legal-confidential"],
            },
            severity: {
              type: "string" as const,
              enum: ["block", "warn"],
            },
            snippet: { type: "string" as const },
            rationale: { type: "string" as const },
          },
          required: ["label", "severity", "snippet", "rationale"],
        },
      },
    },
    required: ["findings"],
  },
};

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _client;
}

function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

function readCache(contentHash: string): Finding[] | null {
  const row = db
    .prepare(
      `SELECT findings_json FROM compliance_llm_cache
       WHERE content_hash = ? AND prompt_version = ? AND model = ?`,
    )
    .get(contentHash, COMPLIANCE_PROMPT_VERSION, COMPLIANCE_MODEL) as
    | { findings_json: string }
    | undefined;
  return row ? (JSON.parse(row.findings_json) as Finding[]) : null;
}

function writeCache(contentHash: string, findings: Finding[]) {
  db.prepare(
    `INSERT OR REPLACE INTO compliance_llm_cache
     (content_hash, prompt_version, model, findings_json, created_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(
    contentHash,
    COMPLIANCE_PROMPT_VERSION,
    COMPLIANCE_MODEL,
    JSON.stringify(findings),
    Date.now(),
  );
}

/**
 * Semantic compliance pass. Cached by (content_hash, prompt_version, model) so
 * an unchanged document never re-pays for the LLM call. Returns [] (and logs)
 * when no API key is configured, so ingest still works regex-only.
 *
 * @param text     scrubbed markdown to audit
 * @param opts.contentHash  cache key; defaults to a hash of `text`
 */
export async function llmComplianceScan(
  text: string,
  opts: { contentHash?: string } = {},
): Promise<Finding[]> {
  const contentHash = opts.contentHash ?? sha256(text);

  const cached = readCache(contentHash);
  if (cached) return cached;

  if (!process.env.ANTHROPIC_API_KEY) {
    // eslint-disable-next-line no-console
    console.warn("[compliance] ANTHROPIC_API_KEY unset — skipping LLM pass");
    return [];
  }

  const response = await client().messages.create({
    model: COMPLIANCE_MODEL,
    max_tokens: 1500,
    temperature: 0,
    system: COMPLIANCE_PROMPT,
    tools: [REPORT_TOOL as never],
    tool_choice: { type: "tool", name: "report_findings" },
    messages: [{ role: "user", content: text.slice(0, 60_000) }],
  });

  const toolBlock = response.content.find(
    (b) => b.type === "tool_use",
  ) as { type: "tool_use"; input: unknown } | undefined;

  const parsed = ComplianceFindingsSchema.safeParse(toolBlock?.input ?? {});
  const findings: Finding[] = parsed.success
    ? parsed.data.findings.map((f) => ({
        detector: "llm-semantic",
        label: f.label,
        severity: f.severity,
        snippet: f.snippet.slice(0, 120),
        rationale: f.rationale.slice(0, 200),
      }))
    : [];

  writeCache(contentHash, findings);
  return findings;
}
