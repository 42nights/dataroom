import { NextRequest, NextResponse } from "next/server";
import { ensureSchema } from "@/lib/db/ensure";
import {
  appendMessage,
  createThread,
  getRecentHistory,
  getThread,
  touchThread,
} from "@/lib/chat-db";
import { answerQuestion } from "@/lib/search";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  ensureSchema();
  const body = (await req.json().catch(() => ({}))) as {
    threadId?: number;
    message?: string;
  };
  const message = body.message?.trim();
  if (!message) {
    return NextResponse.json({ error: "message required" }, { status: 400 });
  }
  if (message.length > 4000) {
    return NextResponse.json({ error: "message too long" }, { status: 400 });
  }

  let threadId = body.threadId;
  if (!threadId || !getThread(threadId)) {
    threadId = createThread(message.slice(0, 80));
  } else {
    const existing = getThread(threadId)!;
    if (!existing.title || existing.title === "New chat") {
      touchThread(threadId, message.slice(0, 80));
    } else {
      touchThread(threadId);
    }
  }

  appendMessage({
    threadId,
    role: "user",
    content: message,
    status: "complete",
  });
  audit("ask", "thread", threadId, { length: message.length });

  const history = getRecentHistory(threadId, 6).slice(0, -1); // exclude the just-appended user msg

  try {
    const result = await answerQuestion(message, history);
    const assistantId = appendMessage({
      threadId,
      role: "assistant",
      content: result.answer,
      status: "complete",
      answerable: result.answerable,
      confidence: result.confidence,
      citations: result.citationsWithDoc,
      followups: result.followups,
      promptVersion: result.promptVersion,
    });
    return NextResponse.json({
      threadId,
      assistantMessageId: assistantId,
      answer: result.answer,
      answerable: result.answerable,
      confidence: result.confidence,
      citations: result.citationsWithDoc,
      followups: result.followups,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const assistantId = appendMessage({
      threadId,
      role: "assistant",
      content: `Error: ${message}`,
      status: "error",
      errorMessage: message,
    });
    return NextResponse.json(
      { threadId, assistantMessageId: assistantId, error: message },
      { status: 500 },
    );
  }
}
