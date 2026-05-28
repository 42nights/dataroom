import { NextRequest, NextResponse } from "next/server";
import { ensureSchema } from "@/lib/db/ensure";
import { createThread, listThreads } from "@/lib/chat-db";

export const runtime = "nodejs";

export async function GET() {
  ensureSchema();
  return NextResponse.json({ threads: listThreads() });
}

export async function POST(req: NextRequest) {
  ensureSchema();
  const body = (await req.json().catch(() => ({}))) as { title?: string };
  const id = createThread((body.title ?? "New chat").slice(0, 80));
  return NextResponse.json({ threadId: id });
}
