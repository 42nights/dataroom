import { NextRequest, NextResponse } from "next/server";
import { ensureSchema } from "@/lib/db/ensure";
import { rescanDocument } from "@/lib/compliance";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";

function parseId(s: string): number | null {
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  ensureSchema();
  const { id } = await ctx.params;
  const docId = parseId(id);
  if (!docId) return NextResponse.json({ error: "bad id" }, { status: 400 });

  const result = await rescanDocument(docId);
  if (!result) return NextResponse.json({ error: "not found" }, { status: 404 });

  audit("compliance-rescan", "document", docId, {
    severity: result.severity,
    labels: result.labels,
  });

  return NextResponse.json({
    ok: true,
    document_id: docId,
    labels: result.labels,
    severity: result.severity,
    findings: result.findings.length,
  });
}
