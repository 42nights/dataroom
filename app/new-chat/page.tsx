"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createThread } from "@/lib/api-client";

export default function NewChatPage() {
  const router = useRouter();
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const id = await createThread();
        if (!cancelled) router.replace(`/chat/${id}`);
      } catch {
        if (!cancelled) router.replace("/sources");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
      Starting a new chat…
    </div>
  );
}
