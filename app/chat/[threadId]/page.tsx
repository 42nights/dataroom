"use client";

import { use } from "react";
import { AppShell } from "@/components/AppShell";
import { ChatThread } from "@/components/ChatThread";

export default function ChatPage({
  params,
}: {
  params: Promise<{ threadId: string }>;
}) {
  const { threadId } = use(params);
  const id = Number(threadId);
  if (!Number.isFinite(id)) {
    return (
      <AppShell>
        <div className="p-8 text-sm text-muted-foreground">Bad thread id.</div>
      </AppShell>
    );
  }
  return (
    <AppShell>
      <ChatThread threadId={id} />
    </AppShell>
  );
}
