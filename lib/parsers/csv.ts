import Papa from "papaparse";

export async function parseCsvToMarkdown(
  buf: Buffer,
): Promise<{ markdown: string; parserUsed: string }> {
  const text = buf.toString("utf8");
  const parsed = Papa.parse<string[]>(text, { skipEmptyLines: true });
  const data = parsed.data;
  if (!data.length) return { markdown: "", parserUsed: "papaparse" };
  const [header, ...rows] = data;
  const escape = (cell: string) =>
    (cell ?? "").toString().replace(/\|/g, "\\|").replace(/\n/g, " ");
  const lines = [
    `| ${header.map(escape).join(" | ")} |`,
    `| ${header.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map(escape).join(" | ")} |`),
  ];
  return { markdown: lines.join("\n"), parserUsed: "papaparse" };
}
