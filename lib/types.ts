export type SourceRow = {
  id: number;
  title: string;
  original_filename: string;
  mime: string;
  size_bytes: number;
  content_hash: string;
  storage_path: string;
  status:
    | "uploaded"
    | "parsing"
    | "embedding"
    | "ready"
    | "error"
    | "replaced"
    | "deleted";
  parser_used: string | null;
  prompt_version: string | null;
  parsed_markdown_preview: string | null;
  chunk_count: number | null;
  error_message: string | null;
  created_at: number;
  updated_at: number;
};

export type ThreadRow = {
  id: number;
  title: string;
  created_at: number;
  updated_at: number;
};

export type Citation = {
  sourceId: string;
  quote: string;
  whyRelevant: string;
  documentId?: number;
  chunkIndex?: number;
  title?: string;
};

export type Message = {
  id: number;
  thread_id: number;
  role: "user" | "assistant" | "system";
  content: string;
  status: "pending" | "streaming" | "complete" | "error";
  answerable: boolean | null;
  confidence: string | null;
  citations: Citation[];
  followups: string[];
  prompt_version: string | null;
  error_message: string | null;
  created_at: number;
};
