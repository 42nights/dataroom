import { NextRequest, NextResponse } from "next/server";
import { ensureSchema } from "@/lib/db/ensure";
import { deleteThread, getThread, renameThread } from "@/lib/chat-db";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  ensureSchema();
  const { id } = await ctx.params;
  const threadId = Number(id);
  if (!Number.isFinite(threadId))
    return NextResponse.json({ error: "bad id" }, { status: 400 });
  const t = getThread(threadId);
  if (!t) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ thread: t });
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  ensureSchema();
  const { id } = await ctx.params;
  const threadId = Number(id);
  const body = (await req.json().catch(() => ({}))) as { title?: string };
  if (!body.title?.trim())
    return NextResponse.json({ error: "title required" }, { status: 400 });
  renameThread(threadId, body.title.trim());
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  ensureSchema();
  const { id } = await ctx.params;
  const threadId = Number(id);
  deleteThread(threadId);
  return NextResponse.json({ ok: true });
}
