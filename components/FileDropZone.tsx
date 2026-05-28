"use client";

import { useCallback, useRef, useState } from "react";
import { useSWRConfig } from "swr";
import { toast } from "sonner";
import { uploadFile } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { Upload, Loader2 } from "lucide-react";

type UploadStatus =
  | { state: "uploading"; name: string }
  | { state: "done"; name: string; deduped: boolean }
  | { state: "error"; name: string; message: string };

const ACCEPT =
  ".pdf,.docx,.txt,.md,.markdown,.csv,.xlsx,.json,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,text/plain,text/markdown,application/json";

const MAX_BYTES = 25 * 1024 * 1024;

export function FileDropZone() {
  const { mutate } = useSWRConfig();
  const inputRef = useRef<HTMLInputElement>(null);
  const [hovering, setHovering] = useState(false);
  const [items, setItems] = useState<UploadStatus[]>([]);

  const upload = useCallback(
    async (file: File) => {
      const update = (s: UploadStatus) =>
        setItems((prev) => {
          const i = prev.findIndex((p) => p.name === file.name);
          if (i < 0) return [...prev, s];
          const copy = [...prev];
          copy[i] = s;
          return copy;
        });

      if (file.size > MAX_BYTES) {
        update({ state: "error", name: file.name, message: "Over 25 MB" });
        return;
      }
      update({ state: "uploading", name: file.name });
      try {
        const result = await uploadFile(file);
        if (result.ok) {
          update({
            state: "done",
            name: file.name,
            deduped: !!result.deduped,
          });
          if (result.deduped) toast.info(`${file.name} already indexed`);
          else toast.success(`${file.name} indexed`);
          mutate("/api/sources");
        } else {
          throw new Error(result.error ?? "Upload failed");
        }
      } catch (err) {
        const message = (err as Error).message ?? "Upload error";
        update({ state: "error", name: file.name, message });
        toast.error(`${file.name}: ${message}`);
      }
    },
    [mutate],
  );

  const handleFiles = useCallback(
    (files: FileList | File[]) => {
      for (const f of Array.from(files)) void upload(f);
    },
    [upload],
  );

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setHovering(true);
        }}
        onDragLeave={() => setHovering(false)}
        onDrop={(e) => {
          e.preventDefault();
          setHovering(false);
          if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "relative rounded-lg border-2 border-dashed border-border p-10 text-center cursor-pointer transition-colors",
          hovering ? "border-primary bg-primary/5" : "hover:border-foreground/40",
        )}
      >
        <Upload className="h-6 w-6 mx-auto text-muted-foreground" />
        <div className="mt-3 text-sm font-medium">
          Drop files here, or click to browse
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          PDF, DOCX, XLSX, CSV, JSON, MD, TXT · up to 25&nbsp;MB
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {items.length > 0 && (
        <div className="rounded-lg border border-border bg-background">
          <div className="px-4 py-2 border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground">
            Recent uploads
          </div>
          <ul className="divide-y divide-border">
            {items.slice(-10).reverse().map((it) => (
              <li
                key={`${it.name}-${it.state}`}
                className="px-4 py-2 flex items-center gap-3 text-sm"
              >
                <span className="flex-1 truncate">{it.name}</span>
                {it.state === "uploading" && (
                  <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Indexing
                  </span>
                )}
                {it.state === "done" && (
                  <span className="text-xs text-emerald-700">
                    {it.deduped ? "Already indexed" : "Ready"}
                  </span>
                )}
                {it.state === "error" && (
                  <span className="text-xs text-red-700" title={it.message}>
                    {it.message}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
