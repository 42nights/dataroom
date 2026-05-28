import { NextRequest, NextResponse } from "next/server";
import { ensureSchema } from "@/lib/db/ensure";
import { getDocument } from "@/lib/ingest";
import { getChunkWithContext } from "@/lib/vector";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string; idx: string }> },
) {
  ensureSchema();
  const { id, idx } = await ctx.params;
  const docId = Number(id);
  const chunkIdx = Number(idx);
  if (!Number.isFinite(docId) || !Number.isFinite(chunkIdx)) {
    return NextResponse.json({ error: "bad params" }, { status: 400 });
  }
  const doc = getDocument(docId);
  if (!doc) return NextResponse.json({ error: "not found" }, { status: 404 });
  const surrounding = getChunkWithContext(docId, chunkIdx, 1, 1);
  return NextResponse.json({
    title: doc.title,
    targetIndex: chunkIdx,
    surrounding,
  });
}
