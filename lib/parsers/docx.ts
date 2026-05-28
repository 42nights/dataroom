import mammoth from "mammoth";

const mam = mammoth as unknown as {
  convertToMarkdown: (input: { buffer: Buffer }) => Promise<{ value: string }>;
};

export async function parseDocxToMarkdown(
  buf: Buffer,
): Promise<{ markdown: string; parserUsed: string }> {
  const result = await mam.convertToMarkdown({ buffer: buf });
  return { markdown: result.value, parserUsed: "mammoth" };
}
