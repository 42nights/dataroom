export async function parsePdfToMarkdown(
  buf: Buffer,
): Promise<{ markdown: string; parserUsed: string }> {
  // Lazy import to keep top-level cold-start light. The legacy build is the
  // Node-friendly one. We avoid touching GlobalWorkerOptions.workerSrc —
  // recent pdfjs versions reject non-string values there even when the worker
  // is disabled via the per-call flag below.
  const pdfjsLib: any = await import("pdfjs-dist/legacy/build/pdf.mjs");
  // Copy bytes into a fresh ArrayBuffer; pdfjs transfers ownership and would
  // detach the original SharedArrayBuffer/Buffer view otherwise.
  const data = new Uint8Array(buf.byteLength);
  data.set(new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength));
  const doc = await pdfjsLib.getDocument({
    data,
    disableWorker: true,
    isEvalSupported: false,
    useSystemFonts: false,
  }).promise;
  const parts: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const text = (content.items as Array<{ str?: string }>)
      .map((it) => (it && typeof it.str === "string" ? it.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    parts.push(`## Page ${i}\n\n${text}\n`);
  }
  await doc.cleanup();
  return { markdown: parts.join("\n"), parserUsed: "pdfjs" };
}
