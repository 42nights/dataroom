import { search, type SearchHit } from "./vector";
import { RETRIEVAL } from "./constants";
import {
  validateCitations,
  assertsFact,
  type ContextChunk,
  type SubmitAnswer,
} from "./citations";
import { buildSystemPrompt, STRICTER_RETRY_NUDGE, PROMPT_VERSION } from "./prompts";
import { callAnthropic, type ChatHistory } from "./anthropic";
import { getChunkWithContext } from "./vector";

export type AnswerResult = SubmitAnswer & {
  promptVersion: string;
  citationsWithDoc: Array<
    SubmitAnswer["citations"][number] & {
      documentId?: number;
      chunkIndex?: number;
      title?: string;
    }
  >;
};

export type ContextWithChunks = {
  context: string;
  chunks: ContextChunk[];
};

function buildContextBlock(hits: SearchHit[]): ContextWithChunks {
  // Group adjacent chunks per document; expand with surrounding context.
  const byDoc = new Map<number, SearchHit[]>();
  for (const h of hits) {
    const arr = byDoc.get(h.documentId) ?? [];
    arr.push(h);
    byDoc.set(h.documentId, arr);
  }

  const blocks: string[] = [];
  const chunks: ContextChunk[] = [];
  let sn = 0;

  for (const [documentId, list] of byDoc) {
    list.sort((a, b) => a.chunkIndex - b.chunkIndex);
    const title = list[0].title;
    sn++;
    const sid = `S${sn}`;

    const seen = new Set<number>();
    const segments: { idx: number; text: string }[] = [];
    for (const hit of list) {
      const around = getChunkWithContext(
        documentId,
        hit.chunkIndex,
        RETRIEVAL.chunkContextBefore,
        RETRIEVAL.chunkContextAfter,
      );
      for (const c of around) {
        if (seen.has(c.chunk_index)) continue;
        seen.add(c.chunk_index);
        segments.push({ idx: c.chunk_index, text: c.text });
      }
    }
    segments.sort((a, b) => a.idx - b.idx);

    let body = "";
    let last = -2;
    for (const s of segments) {
      if (last !== -2 && s.idx !== last + 1) body += "\n[...]\n";
      body += s.text + "\n";
      last = s.idx;
    }
    body = body.trim();
    blocks.push(
      `<source id="${sid}" title=${JSON.stringify(title)}>\n${body}\n</source>`,
    );
    chunks.push({
      sourceId: sid,
      text: body,
      title,
      documentId,
      chunkIndex: list[0].chunkIndex,
    });
  }

  return { context: blocks.join("\n\n"), chunks };
}

export async function answerQuestion(
  question: string,
  history: ChatHistory = [],
): Promise<AnswerResult> {
  const hits = await search(question, {
    limit: RETRIEVAL.limit,
    minScore: 0,
  });

  if (
    hits.length < RETRIEVAL.anyResultMin ||
    (hits[0]?.score ?? 0) < RETRIEVAL.topScoreMin
  ) {
    return {
      answerable: false,
      answer:
        "I don't have information about that in the data room. Try rephrasing, or upload a file that covers it.",
      citations: [],
      confidence: "none",
      followups: [],
      promptVersion: PROMPT_VERSION,
      citationsWithDoc: [],
    };
  }

  const { context, chunks } = buildContextBlock(hits);
  const systemPrompt = buildSystemPrompt();
  const userTurn = `<context>\n${context}\n</context>\n\nQuestion: ${question}`;

  let { raw, rawText } = await callAnthropic(systemPrompt, userTurn, history);
  if (!raw) {
    return {
      answerable: false,
      answer:
        rawText.trim() ||
        "The model didn't return a structured answer. Try rephrasing.",
      citations: [],
      confidence: "none",
      followups: [],
      promptVersion: PROMPT_VERSION,
      citationsWithDoc: [],
    };
  }

  let validated = validateCitations(raw, chunks);

  if (
    validated.answerable &&
    validated.citations.length === 0 &&
    assertsFact(validated.answer)
  ) {
    const retry = await callAnthropic(
      `${systemPrompt}\n\n${STRICTER_RETRY_NUDGE}`,
      userTurn,
      history,
    );
    if (retry.raw) {
      validated = validateCitations(retry.raw, chunks);
      if (validated.citations.length === 0) {
        validated = {
          ...validated,
          answerable: false,
          confidence: "none",
          answer:
            "I couldn't ground that answer in the data room. The retrieved sources don't directly support a confident answer.",
        };
      }
    }
  }

  const citationsWithDoc = validated.citations.map((c) => {
    const ctx = chunks.find((ch) => ch.sourceId === c.sourceId);
    return {
      ...c,
      documentId: ctx?.documentId,
      chunkIndex: ctx?.chunkIndex,
      title: ctx?.title,
    };
  });

  return { ...validated, promptVersion: PROMPT_VERSION, citationsWithDoc };
}
