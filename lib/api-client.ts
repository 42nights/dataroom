import type { Citation, Message, SourceRow, ThreadRow } from "./types";

async function jsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = "";
    try {
      detail = (await res.json()).error ?? "";
    } catch {
      detail = await res.text();
    }
    throw new Error(detail || `${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export const fetcher = async (url: string) => {
  const res = await fetch(url);
  return jsonOrThrow<any>(res);
};

export async function uploadFile(
  file: File,
  title?: string,
): Promise<{ ok: boolean; documentId?: number; deduped?: boolean; error?: string }> {
  const fd = new FormData();
  fd.append("file", file);
  if (title) fd.append("title", title);
  const res = await fetch("/api/upload", { method: "POST", body: fd });
  return jsonOrThrow(res);
}

export async function deleteSource(id: number) {
  const res = await fetch(`/api/sources/${id}`, { method: "DELETE" });
  return jsonOrThrow<{ ok: true }>(res);
}

export async function renameSource(id: number, title: string) {
  const res = await fetch(`/api/sources/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ title }),
  });
  return jsonOrThrow<{ ok: true }>(res);
}

export async function listSources(): Promise<SourceRow[]> {
  return (await fetcher("/api/sources")).sources;
}

export async function createThread(title?: string): Promise<number> {
  const res = await fetch("/api/chat/threads", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ title }),
  });
  const data = await jsonOrThrow<{ threadId: number }>(res);
  return data.threadId;
}

export async function sendMessage(
  threadId: number | null,
  message: string,
): Promise<{
  threadId: number;
  assistantMessageId: number;
  answer: string;
  answerable: boolean;
  confidence: string;
  citations: Citation[];
  followups: string[];
}> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ threadId, message }),
  });
  return jsonOrThrow(res);
}

export async function getChunkPreview(
  documentId: number,
  chunkIndex: number,
): Promise<{
  title: string;
  targetIndex: number;
  surrounding: Array<{ chunk_index: number; text: string }>;
}> {
  return fetcher(`/api/sources/${documentId}/chunks/${chunkIndex}`);
}
