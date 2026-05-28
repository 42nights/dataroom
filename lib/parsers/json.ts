export async function parseJsonToMarkdown(
  buf: Buffer,
): Promise<{ markdown: string; parserUsed: string }> {
  const text = buf.toString("utf8");
  let pretty: string;
  try {
    pretty = JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    pretty = text;
  }
  const md = "```json\n" + pretty + "\n```";
  return { markdown: md, parserUsed: "json" };
}
