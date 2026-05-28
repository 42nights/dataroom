"use client";

import { useState } from "react";
import { CitationChip } from "./CitationChip";
import { SourcePreviewSheet, type PreviewCitation } from "./SourcePreviewSheet";
import { Badge } from "./ui/badge";
import type { Message } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

export function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";
  const [openCitation, setOpenCitation] = useState<PreviewCitation | null>(null);

  if (isUser) {
    return (
      <div className="flex justify-end animate-fade-in">
        <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-foreground text-background px-4 py-2.5 text-sm whitespace-pre-wrap">
          {message.content}
        </div>
      </div>
    );
  }

  const isPending =
    message.status === "pending" || message.status === "streaming";
  const isError = message.status === "error";
  const citations = message.citations ?? [];

  return (
    <>
      <div className="flex animate-fade-in">
        <div className="max-w-[85%] space-y-3">
          {message.answerable === false && message.status === "complete" && (
            <Badge variant="outline">Not in the data room</Badge>
          )}
          {isError && <Badge variant="error">Error</Badge>}

          {isPending ? (
            <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Searching the data room…
            </div>
          ) : (
            <div
              className={cn(
                "text-sm leading-relaxed whitespace-pre-wrap",
                isError && "text-red-700",
              )}
            >
              {message.content}
              {citations.length > 0 && (
                <span className="inline-block ml-1">
                  {citations.map((c, i) => (
                    <CitationChip
                      key={i}
                      index={i + 1}
                      title={c.title}
                      onClick={() => setOpenCitation(c)}
                    />
                  ))}
                </span>
              )}
            </div>
          )}

          {message.confidence &&
            message.confidence !== "none" &&
            !isPending && (
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                confidence: {message.confidence}
              </div>
            )}

          {message.followups && message.followups.length > 0 && !isPending && (
            <div className="flex flex-wrap gap-2 pt-1">
              {message.followups.map((f, i) => (
                <button
                  key={i}
                  type="button"
                  className="text-xs rounded-full border border-border px-3 py-1 hover:bg-muted transition-colors"
                  onClick={() =>
                    window.dispatchEvent(
                      new CustomEvent("compose:fill", { detail: f }),
                    )
                  }
                >
                  {f}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <SourcePreviewSheet
        citation={openCitation}
        open={!!openCitation}
        onOpenChange={(o) => !o && setOpenCitation(null)}
      />
    </>
  );
}
