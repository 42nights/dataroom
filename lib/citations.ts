import { z } from "zod";

export const SubmitAnswerSchema = z.object({
  answerable: z.boolean(),
  answer: z.string().min(1),
  citations: z
    .array(
      z.object({
        sourceId: z.string(),
        quote: z.string().min(1),
        whyRelevant: z.string().min(1),
      }),
    )
    .default([]),
  confidence: z.enum(["high", "medium", "low", "none"]),
  followups: z.array(z.string()).max(3).default([]),
});

export type SubmitAnswer = z.infer<typeof SubmitAnswerSchema>;

export const SUBMIT_ANSWER_TOOL = {
  name: "submit_answer",
  description:
    "Submit the final answer to the user's question. Always call this exactly once.",
  input_schema: {
    type: "object" as const,
    properties: {
      answerable: { type: "boolean" as const },
      answer: { type: "string" as const },
      citations: {
        type: "array" as const,
        items: {
          type: "object" as const,
          properties: {
            sourceId: { type: "string" as const },
            quote: { type: "string" as const },
            whyRelevant: { type: "string" as const },
          },
          required: ["sourceId", "quote", "whyRelevant"],
        },
      },
      confidence: {
        type: "string" as const,
        enum: ["high", "medium", "low", "none"],
      },
      followups: { type: "array" as const, items: { type: "string" as const } },
    },
    required: ["answerable", "answer", "citations", "confidence"],
  },
};

export type ContextChunk = {
  sourceId: string;
  text: string;
  title?: string;
  documentId?: number;
  chunkIndex?: number;
};

const norm = (s: string) => s.replace(/\s+/g, " ").toLowerCase().trim();

export function validateCitations(
  raw: SubmitAnswer,
  contextChunks: ContextChunk[],
): SubmitAnswer {
  const bySource = new Map<string, ContextChunk[]>();
  for (const c of contextChunks) {
    const arr = bySource.get(c.sourceId) ?? [];
    arr.push(c);
    bySource.set(c.sourceId, arr);
  }
  const validated = raw.citations.filter((cit) => {
    const sources = bySource.get(cit.sourceId);
    if (!sources || sources.length === 0) return false;
    const haystack = norm(sources.map((s) => s.text).join("\n"));
    const needle = norm(cit.quote).slice(0, 200);
    if (!needle) return false;
    return haystack.includes(needle);
  });
  return { ...raw, citations: validated };
}

const FACT_REGEX =
  /\b(is|are|was|were|has|have|costs?|spent|paid|signed|agreed|will|did|does|earns?|owes?|owns?)\b/i;

export function assertsFact(answer: string): boolean {
  return FACT_REGEX.test(answer) && answer.trim().split(/\s+/).length > 6;
}
