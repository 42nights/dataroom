import { NextRequest, NextResponse } from "next/server";
import { ensureSchema } from "@/lib/db/ensure";
import { getDocument } from "@/lib/ingest";
import { getDocumentCompliance } from "@/lib/compliance";
import type { Finding } from "@/lib/compliance";

export const runtime = "nodejs";

function parseId(s: string): number | null {
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  ensureSchema();
  const { id } = await ctx.params;
  const docId = parseId(id);
  if (!docId) return NextResponse.json({ error: "bad id" }, { status: 400 });

  const doc = getDocument(docId);
  if (!doc) return NextResponse.json({ error: "not found" }, { status: 404 });

  const row = getDocumentCompliance(docId);
  if (!row) {
    return NextResponse.json({
      document_id: docId,
      title: doc.title,
      scanned: false,
    });
  }

  return NextResponse.json({
    document_id: docId,
    title: doc.title,
    scanned: true,
    labels: JSON.parse(row.labels_json),
    highest_severity: row.highest_severity,
    findings: JSON.parse(row.findings_json) as Finding[],
    regex_pass_version: row.regex_pass_version,
    llm_pass_version: row.llm_pass_version,
    llm_pass_model: row.llm_pass_model,
    scanned_at: row.scanned_at,
  });
}
