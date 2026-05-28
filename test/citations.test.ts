import { describe, it, expect } from "vitest";
import {
  validateCitations,
  assertsFact,
  type ContextChunk,
} from "../lib/citations";

const chunks: ContextChunk[] = [
  { sourceId: "S1", text: "The contract spend cap is twenty thousand dollars per quarter." },
  { sourceId: "S2", text: "Customer ACME signed on 2026-01-15 in Palo Alto." },
];

describe("validateCitations", () => {
  it("keeps citations whose quote appears in the source", () => {
    const result = validateCitations(
      {
        answerable: true,
        answer: "Spend cap is $20k per quarter.",
        citations: [
          {
            sourceId: "S1",
            quote: "spend cap is twenty thousand dollars per quarter",
            whyRelevant: "states the cap",
          },
        ],
        confidence: "high",
        followups: [],
      },
      chunks,
    );
    expect(result.citations.length).toBe(1);
  });

  it("drops citations whose quote does not appear in the source", () => {
    const result = validateCitations(
      {
        answerable: true,
        answer: "ACME signed in 2025.",
        citations: [
          {
            sourceId: "S2",
            quote: "signed in 2025",
            whyRelevant: "date",
          },
        ],
        confidence: "high",
        followups: [],
      },
      chunks,
    );
    expect(result.citations.length).toBe(0);
  });

  it("drops citations referencing unknown source ids", () => {
    const result = validateCitations(
      {
        answerable: true,
        answer: "foo",
        citations: [
          { sourceId: "S99", quote: "anything", whyRelevant: "x" },
        ],
        confidence: "low",
        followups: [],
      },
      chunks,
    );
    expect(result.citations.length).toBe(0);
  });
});

describe("assertsFact", () => {
  it("detects assertions", () => {
    expect(assertsFact("ACME signed the contract last Tuesday for ten million.")).toBe(true);
  });
  it("ignores short hedges", () => {
    expect(assertsFact("Yes.")).toBe(false);
  });
});
