"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import { getChunkPreview } from "@/lib/api-client";

export type PreviewCitation = {
  sourceId: string;
  documentId?: number;
  chunkIndex?: number;
  title?: string;
  quote: string;
  whyRelevant: string;
};

export function SourcePreviewSheet({
  citation,
  open,
  onOpenChange,
}: {
  citation: PreviewCitation | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [surrounding, setSurrounding] = useState<
    Array<{ chunk_index: number; text: string }>
  >([]);

  useEffect(() => {
    let cancelled = false;
    setSurrounding([]);
    if (!citation?.documentId || citation.chunkIndex == null) return;
    getChunkPreview(citation.documentId, citation.chunkIndex)
      .then((p) => {
        if (!cancelled) setSurrounding(p.surrounding);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [citation?.documentId, citation?.chunkIndex]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent side="right" className="animate-slide-in-right">
        {citation ? (
          <div className="space-y-5 pr-6">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Citation {citation.sourceId}
              </div>
              <DialogTitle className="mt-1 font-serif text-2xl">
                {citation.title ?? "Untitled source"}
              </DialogTitle>
            </div>

            <div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">
                Quoted passage
              </div>
              <blockquote className="border-l-2 border-primary/60 bg-primary/5 px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap">
                {citation.quote}
              </blockquote>
            </div>

            <div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">
                Why it's relevant
              </div>
              <DialogDescription className="text-sm leading-relaxed text-foreground/80">
                {citation.whyRelevant}
              </DialogDescription>
            </div>

            {surrounding.length > 0 && (
              <div>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">
                  Surrounding context
                </div>
                <div className="rounded-md border border-border bg-muted/30 px-3 py-2 max-h-72 overflow-y-auto">
                  {surrounding.map((s) => (
                    <div
                      key={s.chunk_index}
                      className={
                        s.chunk_index === citation.chunkIndex
                          ? "text-sm whitespace-pre-wrap py-2 bg-primary/10 rounded px-2"
                          : "text-xs whitespace-pre-wrap py-2 text-muted-foreground"
                      }
                    >
                      {s.text}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {citation.documentId && (
              <Link
                href={`/sources/${citation.documentId}`}
                className="inline-block text-sm text-primary hover:underline"
              >
                Open full source →
              </Link>
            )}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
