import { NextRequest, NextResponse } from "next/server";
import { ensureSchema } from "@/lib/db/ensure";
import { getMessages } from "@/lib/chat-db";

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
  return NextResponse.json({ messages: getMessages(threadId) });
}
