export async function parsePlainToMarkdown(
  buf: Buffer,
): Promise<{ markdown: string; parserUsed: string }> {
  return { markdown: buf.toString("utf8"), parserUsed: "plain" };
}

export async function parseMarkdownPassthrough(
  buf: Buffer,
): Promise<{ markdown: string; parserUsed: string }> {
  return { markdown: buf.toString("utf8"), parserUsed: "markdown" };
}
