"use client";

import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { fetcher, sendMessage } from "@/lib/api-client";
import type { Message, ThreadRow } from "@/lib/types";
import { MessageBubble } from "./MessageBubble";
import { ComposeBox } from "./ComposeBox";

export function ChatThread({ threadId }: { threadId: number }) {
  const { data: threadData } = useSWR<{ thread: ThreadRow }>(
    `/api/chat/threads/${threadId}`,
    fetcher,
  );
  const { data: msgData, mutate: refetchMessages } = useSWR<{
    messages: Message[];
  }>(`/api/chat/threads/${threadId}/messages`, fetcher, {
    refreshInterval: 0,
  });
  const messages = msgData?.messages ?? [];
  const [sending, setSending] = useState(false);
  const [pendingOptimistic, setPendingOptimistic] = useState<Message[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, pendingOptimistic.length]);

  const combined = [...messages, ...pendingOptimistic];

  async function onSubmit(content: string) {
    setSending(true);
    const tempUserId = -1 * Date.now();
    const tempAsstId = tempUserId - 1;
    const now = Date.now();
    setPendingOptimistic([
      {
        id: tempUserId,
        thread_id: threadId,
        role: "user",
        content,
        status: "complete",
        answerable: null,
        confidence: null,
        citations: [],
        followups: [],
        prompt_version: null,
        error_message: null,
        created_at: now,
      },
      {
        id: tempAsstId,
        thread_id: threadId,
        role: "assistant",
        content: "",
        status: "pending",
        answerable: null,
        confidence: null,
        citations: [],
        followups: [],
        prompt_version: null,
        error_message: null,
        created_at: now + 1,
      },
    ]);
    try {
      await sendMessage(threadId, content);
      setPendingOptimistic([]);
      await refetchMessages();
    } catch (err) {
      const message = (err as Error).message ?? "Send failed";
      toast.error(message);
      setPendingOptimistic([]);
      await refetchMessages();
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col h-screen">
      <header className="border-b border-border px-8 py-4 flex items-center gap-3">
        <div className="font-serif text-lg truncate">
          {threadData?.thread?.title ?? "Loading…"}
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-8 py-8 space-y-6">
        {!msgData ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : combined.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            Ask a question to get started. Answers are grounded only in the
            uploaded sources.
          </div>
        ) : (
          combined.map((m) => <MessageBubble key={m.id} message={m} />)
        )}
      </div>

      <div className="border-t border-border px-8 py-4">
        <ComposeBox autofocus disabled={sending} onSubmit={onSubmit} />
      </div>
    </div>
  );
}
