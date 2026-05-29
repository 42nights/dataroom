import "./load-env";
import fs from "node:fs/promises";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { ensureSchema } from "../lib/db/ensure";
import { db, PATHS } from "../lib/db/index";
import {
  rescanDocument,
  complianceSummary,
  COMPLIANCE_PROMPT_VERSION,
  type Finding,
  type Severity,
} from "../lib/compliance";
import { COMPLIANCE_ADVERSARIAL_MODEL } from "../lib/constants";

type DocRow = { id: number; title: string };

const ADVERSARIAL_PROMPT = `You are a security reviewer auditing a document from an internal company data room.

Answer two questions, briefly and concretely:
1. If a stranger gained access to this document, what's the worst that could realistically happen?
2. Does this document contain information that should be access-restricted? If so, to whom, and what is it?

Be specific to THIS document. If it's mundane internal material with nothing sensitive, say so plainly — don't manufacture risk. 4 sentences max.`;

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _client;
}

async function adversarialPass(title: string, text: string): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) return "_(adversarial pass skipped — no ANTHROPIC_API_KEY)_";
  try {
    const res = await client().messages.create({
      model: COMPLIANCE_ADVERSARIAL_MODEL,
      max_tokens: 400,
      system: ADVERSARIAL_PROMPT,
      messages: [
        {
          role: "user",
          content: `Document title: ${title}\n\n---\n${text.slice(0, 40_000)}`,
        },
      ],
    });
    return res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
  } catch (err) {
    return `_(adversarial pass failed: ${(err as Error).message})_`;
  }
}

function recommend(severity: Severity, findings: Finding[]): string {
  if (severity === "block") {
    const kinds = Array.from(new Set(findings.filter((f) => f.severity === "block").map((f) => f.detector)));
    return `redact the ${kinds.join(", ")} hit(s); review before sharing externally.`;
  }
  if (severity === "warn") {
    return "leave as-is; flag the file's labels for retrieval-tier filtering once access tiers are live.";
  }
  return "keep — nothing sensitive detected.";
}

function findingLine(f: Finding): string {
  const where = f.chunkIndex != null ? ` (chunk ${f.chunkIndex})` : "";
  const why = f.rationale ? ` — ${f.rationale}` : "";
  return `  - \`${f.detector}\` → **${f.label}** / ${f.severity}${where}: ${f.snippet}${why}`;
}

async function main() {
  ensureSchema();

  const docs = db
    .prepare(`SELECT id, title FROM documents WHERE status = 'ready' ORDER BY id`)
    .all() as DocRow[];

  // eslint-disable-next-line no-console
  console.log(`Auditing ${docs.length} documents…`);

  type Audited = {
    id: number;
    title: string;
    severity: Severity;
    labels: string[];
    findings: Finding[];
    adversarial: string;
  };
  const audited: Audited[] = [];

  for (const d of docs) {
    const result = await rescanDocument(d.id);
    if (!result) continue;
    const chunks = db
      .prepare(`SELECT text FROM chunks WHERE document_id = ? ORDER BY chunk_index`)
      .all(d.id) as Array<{ text: string }>;
    const text = chunks.map((c) => c.text).join("\n\n");
    const adversarial = await adversarialPass(d.title, text);
    audited.push({
      id: d.id,
      title: d.title,
      severity: result.severity,
      labels: result.labels,
      findings: result.findings,
      adversarial,
    });
    // eslint-disable-next-line no-console
    console.log(`  [${result.severity}] ${d.title} (${result.labels.join(",")})`);
  }

  const summary = complianceSummary();
  const generatedAt = new Date().toISOString();
  const topLabels = Object.entries(summary.by_label)
    .sort((a, b) => b[1] - a[1])
    .map(([l, n]) => `${l} (${n})`)
    .join(", ") || "none";

  const order: Record<Severity, number> = { block: 0, warn: 1, clean: 2 };
  audited.sort((a, b) => order[a.severity] - order[b.severity] || a.id - b.id);

  const lines: string[] = [];
  lines.push(`# Data Room Compliance Audit`);
  lines.push(
    `Generated ${generatedAt} · Prompt version ${COMPLIANCE_PROMPT_VERSION} · Adversarial model ${COMPLIANCE_ADVERSARIAL_MODEL}`,
  );
  lines.push("");
  lines.push(`## Summary`);
  lines.push(`- ${summary.scanned_documents} documents scanned`);
  lines.push(
    `- ${summary.by_severity.clean} clean · ${summary.by_severity.warn} warn · ${summary.by_severity.block} block`,
  );
  lines.push(`- Top labels: ${topLabels}`);
  lines.push("");

  const sections: Array<[Severity, string]> = [
    ["block", "High-priority items (severity: block)"],
    ["warn", "Warn-level items"],
    ["clean", "Clean"],
  ];

  for (const [sev, heading] of sections) {
    const group = audited.filter((a) => a.severity === sev);
    if (!group.length) continue;
    lines.push(`## ${heading}`);
    lines.push("");
    for (const a of group) {
      lines.push(`### ${a.title}  \`#${a.id}\``);
      lines.push(`- Labels: ${a.labels.join(", ")}`);
      if (a.findings.length) {
        lines.push(`- Findings:`);
        for (const f of a.findings) lines.push(findingLine(f));
      } else {
        lines.push(`- Findings: none`);
      }
      lines.push(`- Recommendation: ${recommend(a.severity, a.findings)}`);
      lines.push(`- Adversarial note: ${a.adversarial}`);
      lines.push("");
    }
  }

  const stamp = generatedAt.replace(/[:.]/g, "-");
  const outPath = path.join(PATHS.DATA_DIR, `compliance-report-${stamp}.md`);
  await fs.writeFile(outPath, lines.join("\n"), "utf8");

  // eslint-disable-next-line no-console
  console.log(`\nReport written to ${outPath}`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
