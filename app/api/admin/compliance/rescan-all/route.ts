import { NextResponse } from "next/server";
import { ensureSchema } from "@/lib/db/ensure";
import { db } from "@/lib/db";
import { rescanDocument, complianceSummary } from "@/lib/compliance";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";
// Corpus is small (tens of docs) and the LLM pass is cached, so a full rescan
// runs inline within the request. If the corpus grows past a few hundred docs,
// move this to a background queue and have the job id poll real status.
export const maxDuration = 300;

export async function POST() {
  ensureSchema();

  const ids = (
    db
      .prepare(`SELECT id FROM documents WHERE status = 'ready' ORDER BY id`)
      .all() as Array<{ id: number }>
  ).map((r) => r.id);

  const jobId = `rescan-${Date.now()}`;
  let scanned = 0;
  for (const id of ids) {
    const r = await rescanDocument(id);
    if (r) scanned++;
  }

  audit("compliance-rescan-all", "corpus", jobId, { scanned });

  return NextResponse.json({
    ok: true,
    job_id: jobId,
    scanned,
    summary: complianceSummary(),
  });
}
