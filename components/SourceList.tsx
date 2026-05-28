"use client";

import useSWR from "swr";
import { fetcher } from "@/lib/api-client";
import type { SourceRow } from "@/lib/types";
import { SourceCard } from "./SourceCard";

export function SourceList() {
  const { data, isLoading } = useSWR<{ sources: SourceRow[] }>(
    "/api/sources",
    fetcher,
    { refreshInterval: 3000 },
  );
  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading sources…</div>;
  }
  const files = data?.sources ?? [];
  if (!files.length) {
    return (
      <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
        No sources yet. Drop a file above to get started.
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
      {files.map((f) => (
        <SourceCard key={f.id} file={f} />
      ))}
    </div>
  );
}
