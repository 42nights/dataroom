"use client";

import Link from "next/link";
import { useSWRConfig } from "swr";
import { toast } from "sonner";
import { deleteSource } from "@/lib/api-client";
import type { SourceRow } from "@/lib/types";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { formatBytes, formatRelative, mimeLabel } from "@/lib/utils";
import { MoreVertical, Trash2 } from "lucide-react";

export function SourceCard({ file }: { file: SourceRow }) {
  const { mutate } = useSWRConfig();

  const statusVariant =
    file.status === "ready"
      ? ("ready" as const)
      : file.status === "error"
        ? ("error" as const)
        : ("pending" as const);

  return (
    <div className="group relative rounded-lg border border-border bg-background p-4 hover:border-foreground/30 transition-colors">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center text-[10px] font-semibold tracking-wider text-muted-foreground">
          {mimeLabel(file.mime, file.original_filename)}
        </div>
        <div className="flex-1 min-w-0">
          <Link
            href={`/sources/${file.id}`}
            className="block font-medium text-sm truncate hover:underline"
          >
            {file.title}
          </Link>
          <div className="mt-0.5 text-xs text-muted-foreground truncate">
            {file.original_filename}
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="opacity-60 group-hover:opacity-100"
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuSeparator />
            <DropdownMenuItem
              destructive
              onClick={async () => {
                if (!confirm(`Delete "${file.title}"? This can't be undone.`))
                  return;
                await deleteSource(file.id);
                toast.success("Deleted");
                mutate("/api/sources");
              }}
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge variant={statusVariant}>{file.status}</Badge>
        <span>{formatBytes(file.size_bytes)}</span>
        <span>·</span>
        <span>{file.chunk_count ?? 0} chunks</span>
        <span>·</span>
        <span>{formatRelative(file.created_at)}</span>
      </div>

      {file.status === "error" && file.error_message && (
        <div className="mt-2 text-xs text-red-700 line-clamp-2">
          {file.error_message}
        </div>
      )}
    </div>
  );
}
