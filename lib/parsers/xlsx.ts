import * as XLSX from "xlsx";

export async function parseXlsxToMarkdown(
  buf: Buffer,
): Promise<{ markdown: string; parserUsed: string }> {
  const wb = XLSX.read(buf, { type: "buffer" });
  const out: string[] = [];

  for (const name of wb.SheetNames) {
    out.push(`## Sheet: ${name}`);
    out.push("");
    const ws = wb.Sheets[name];
    if (!ws) continue;
    const aoa: unknown[][] = XLSX.utils.sheet_to_json(ws, {
      header: 1,
      blankrows: false,
      defval: "",
    });
    if (!aoa.length) {
      out.push("_(empty sheet)_");
      out.push("");
      continue;
    }
    const escape = (cell: unknown) =>
      String(cell ?? "")
        .replace(/\|/g, "\\|")
        .replace(/\n/g, " ");
    const header = aoa[0].map(escape);
    out.push(`| ${header.join(" | ")} |`);
    out.push(`| ${header.map(() => "---").join(" | ")} |`);
    for (const row of aoa.slice(1)) {
      out.push(`| ${row.map(escape).join(" | ")} |`);
    }
    out.push("");
  }
  return { markdown: out.join("\n"), parserUsed: "xlsx" };
}
