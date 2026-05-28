"use client";

import { cn } from "@/lib/utils";

export function CitationChip({
  index,
  title,
  onClick,
  active,
}: {
  index: number;
  title?: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        "inline-flex items-center justify-center min-w-[20px] h-[20px] rounded-full border text-[10px] font-semibold transition-colors mr-1 align-baseline",
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-background text-foreground border-border hover:bg-muted",
      )}
    >
      {index}
    </button>
  );
}
