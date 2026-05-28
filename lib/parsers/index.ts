import { parsePdfToMarkdown } from "./pdf";
import { parseDocxToMarkdown } from "./docx";
import { parseXlsxToMarkdown } from "./xlsx";
import { parseCsvToMarkdown } from "./csv";
import { parseJsonToMarkdown } from "./json";
import {
  parsePlainToMarkdown,
  parseMarkdownPassthrough,
} from "./plain";

export type ParseResult = { markdown: string; parserUsed: string };

export async function parseToMarkdown(
  buf: Buffer,
  mime: string,
  filename: string,
): Promise<ParseResult> {
  const name = filename.toLowerCase();
  const isPdf = mime === "application/pdf" || name.endsWith(".pdf");
  const isDocx =
    mime ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    name.endsWith(".docx");
  const isXlsx =
    mime ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    name.endsWith(".xlsx");
  const isCsv = mime === "text/csv" || name.endsWith(".csv");
  const isJson = mime === "application/json" || name.endsWith(".json");
  const isMd =
    mime === "text/markdown" ||
    name.endsWith(".md") ||
    name.endsWith(".markdown");
  const isTxt = mime === "text/plain" || name.endsWith(".txt");

  if (isPdf) return parsePdfToMarkdown(buf);
  if (isDocx) return parseDocxToMarkdown(buf);
  if (isXlsx) return parseXlsxToMarkdown(buf);
  if (isCsv) return parseCsvToMarkdown(buf);
  if (isJson) return parseJsonToMarkdown(buf);
  if (isMd) return parseMarkdownPassthrough(buf);
  if (isTxt) return parsePlainToMarkdown(buf);
  return parsePlainToMarkdown(buf);
}

export const SUPPORTED_MIMES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
  "application/json",
  "text/markdown",
  "text/plain",
];
