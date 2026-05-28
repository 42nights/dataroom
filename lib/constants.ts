export const EMBEDDING_MODEL = "text-embedding-3-small";
export const EMBEDDING_DIM = 1536;

export const GENERATION_MODEL = "claude-opus-4-7";

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export const RETRIEVAL = {
  limit: 8,
  chunkContextBefore: 1,
  chunkContextAfter: 1,
  topScoreMin: 0.3,
  anyResultMin: 1,
} as const;

export const CHUNKER = {
  minChars: 200,
  maxChars: 1200,
  overlapChars: 100,
  hardMax: 4000,
} as const;
