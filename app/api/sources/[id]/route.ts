import { NextRequest, NextResponse } from "next/server";
import { ensureSchema } from "@/lib/db/ensure";
import { deleteDocument, getDocument, renameDocument } from "@/lib/ingest";

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
  return NextResponse.json({ source: doc });
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  ensureSchema();
  const { id } = await ctx.params;
  const docId = parseId(id);
  if (!docId) return NextResponse.json({ error: "bad id" }, { status: 400 });
  const body = (await req.json().catch(() => ({}))) as { title?: string };
  if (typeof body.title !== "string" || !body.title.trim()) {
    return NextResponse.json({ error: "title required" }, { status: 400 });
  }
  renameDocument(docId, body.title);
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  ensureSchema();
  const { id } = await ctx.params;
  const docId = parseId(id);
  if (!docId) return NextResponse.json({ error: "bad id" }, { status: 400 });
  await deleteDocument(docId);
  return NextResponse.json({ ok: true });
}
