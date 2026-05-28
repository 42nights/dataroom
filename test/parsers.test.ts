import { describe, it, expect } from "vitest";
import { parseCsvToMarkdown } from "../lib/parsers/csv";
import { parseJsonToMarkdown } from "../lib/parsers/json";
import {
  parsePlainToMarkdown,
  parseMarkdownPassthrough,
} from "../lib/parsers/plain";

const buf = (s: string) => Buffer.from(s, "utf8");

describe("parsers", () => {
  it("CSV → markdown table", async () => {
    const csv = "name,age\nidan,24\nayaan,30";
    const { markdown, parserUsed } = await parseCsvToMarkdown(buf(csv));
    expect(parserUsed).toBe("papaparse");
    expect(markdown).toContain("| name | age |");
    expect(markdown).toContain("| idan | 24 |");
    expect(markdown).toContain("| ayaan | 30 |");
  });

  it("JSON pretty-printed in fenced block", async () => {
    const json = JSON.stringify({ a: 1, b: [2, 3] });
    const { markdown, parserUsed } = await parseJsonToMarkdown(buf(json));
    expect(parserUsed).toBe("json");
    expect(markdown.startsWith("```json")).toBe(true);
    expect(markdown).toContain('"b": [');
  });

  it("plain text passes through", async () => {
    const text = "Hello there.\n\nSecond paragraph.";
    const { markdown, parserUsed } = await parsePlainToMarkdown(buf(text));
    expect(parserUsed).toBe("plain");
    expect(markdown).toBe(text);
  });

  it("markdown passes through with markdown parser tag", async () => {
    const text = "# Hi\n\nBody.";
    const { markdown, parserUsed } = await parseMarkdownPassthrough(buf(text));
    expect(parserUsed).toBe("markdown");
    expect(markdown).toBe(text);
  });
});
