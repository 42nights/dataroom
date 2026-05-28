"use client";

import { use } from "react";
import Link from "next/link";
import useSWR from "swr";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { fetcher } from "@/lib/api-client";
import type { SourceRow } from "@/lib/types";
import { formatBytes, formatRelative, mimeLabel } from "@/lib/utils";
import { ArrowLeft } from "lucide-react";

export default function SourcePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data, isLoading } = useSWR<{ source: SourceRow }>(
    `/api/sources/${id}`,
    fetcher,
    { refreshInterval: 2000 },
  );
  const file = data?.source;

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto px-8 py-10">
        <Link
          href="/sources"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to sources
        </Link>

        {isLoading && (
          <div className="mt-8 text-sm text-muted-foreground">Loading…</div>
        )}
        {!isLoading && !file && (
          <div className="mt-8 text-sm text-muted-foreground">
            Source not found.
          </div>
        )}
        {file && (
          <>
            <div className="mt-6 flex items-start gap-4">
              <div className="h-14 w-14 rounded-md bg-muted flex items-center justify-center text-xs font-semibold tracking-wider text-muted-foreground">
                {mimeLabel(file.mime, file.original_filename)}
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="font-serif text-2xl">{file.title}</h1>
                <div className="text-sm text-muted-foreground">
                  {file.original_filename}
                </div>
              </div>
            </div>

            <dl className="mt-8 grid grid-cols-2 gap-y-3 gap-x-6 text-sm">
              <Row label="Status">
                <Badge
                  variant={
                    file.status === "ready"
                      ? "ready"
                      : file.status === "error"
                        ? "error"
                        : "pending"
                  }
                >
                  {file.status}
                </Badge>
              </Row>
              <Row label="Size">{formatBytes(file.size_bytes)}</Row>
              <Row label="Chunks">{file.chunk_count ?? 0}</Row>
              <Row label="Parser">{file.parser_used ?? "—"}</Row>
              <Row label="Prompt ver">{file.prompt_version ?? "—"}</Row>
              <Row label="Uploaded">{formatRelative(file.created_at)}</Row>
              <Row label="Content hash">
                <code className="text-xs font-mono">
                  {file.content_hash.slice(0, 12)}…
                </code>
              </Row>
            </dl>

            {file.error_message && (
              <div className="mt-6 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {file.error_message}
              </div>
            )}

            {file.parsed_markdown_preview && (
              <div className="mt-10">
                <h2 className="font-serif text-lg mb-2">Parsed preview</h2>
                <pre className="text-xs whitespace-pre-wrap leading-relaxed bg-muted/40 p-4 rounded-md border border-border max-h-[60vh] overflow-y-auto">
                  {file.parsed_markdown_preview}
                </pre>
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between border-b border-border py-2">
      <dt className="text-muted-foreground text-xs uppercase tracking-wider">
        {label}
      </dt>
      <dd>{children}</dd>
    </div>
  );
}
