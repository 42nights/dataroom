import { describe, it, expect } from "vitest";
import { markdownChunker } from "../lib/chunker";

describe("markdownChunker", () => {
  it("returns at least one chunk for plain text", () => {
    const chunks = markdownChunker("hello world");
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].text).toContain("hello world");
  });

  it("splits long content into multiple bounded chunks", () => {
    const para = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. ".repeat(80);
    const md = `# Title\n\n${para}`;
    const chunks = markdownChunker(md, {
      maxChars: 400,
      minChars: 100,
      overlapChars: 50,
      hardMax: 1000,
    });
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) {
      expect(c.text.length).toBeLessThanOrEqual(1200);
    }
  });

  it("keeps a markdown table together", () => {
    const table = [
      "| col1 | col2 |",
      "| --- | --- |",
      "| a | b |",
      "| c | d |",
    ].join("\n");
    const md = `## Section\n\n${table}\n`;
    const chunks = markdownChunker(md);
    const found = chunks.find(
      (c) => c.text.includes("| a | b |") && c.text.includes("| c | d |"),
    );
    expect(found).toBeDefined();
  });

  it("filters empty chunks", () => {
    const chunks = markdownChunker("\n\n\n");
    expect(chunks).toEqual([]);
  });
});
