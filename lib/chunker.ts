import { CHUNKER } from "./constants";

export type ChunkerOptions = {
  minChars: number;
  maxChars: number;
  overlapChars: number;
  hardMax: number;
};

export type Chunk = { text: string };

const DEFAULTS: ChunkerOptions = CHUNKER;

const HEADING_RE = /^(#{1,6})\s+(.+)$/;
const TABLE_LINE_RE = /^\s*\|/;

type Block =
  | { type: "heading"; level: number; text: string }
  | { type: "table"; text: string }
  | { type: "para"; text: string };

function splitIntoBlocks(md: string): Block[] {
  const lines = md.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === "") {
      i++;
      continue;
    }
    const h = line.match(HEADING_RE);
    if (h) {
      blocks.push({ type: "heading", level: h[1].length, text: h[2].trim() });
      i++;
      continue;
    }
    if (TABLE_LINE_RE.test(line)) {
      const start = i;
      while (i < lines.length && TABLE_LINE_RE.test(lines[i])) i++;
      blocks.push({ type: "table", text: lines.slice(start, i).join("\n") });
      continue;
    }
    const start = i;
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !lines[i].match(HEADING_RE) &&
      !TABLE_LINE_RE.test(lines[i])
    ) {
      i++;
    }
    blocks.push({ type: "para", text: lines.slice(start, i).join("\n") });
  }
  return blocks;
}

function splitLongText(text: string, maxChars: number, hardMax: number): string[] {
  if (text.length <= maxChars) return [text];
  const out: string[] = [];
  const paras = text.split(/\n\s*\n/);
  let buf = "";
  for (const p of paras) {
    if ((buf + "\n\n" + p).length > maxChars && buf) {
      out.push(buf.trim());
      buf = p;
    } else {
      buf = buf ? buf + "\n\n" + p : p;
    }
  }
  if (buf) out.push(buf.trim());

  const further: string[] = [];
  for (const piece of out) {
    if (piece.length <= maxChars) {
      further.push(piece);
      continue;
    }
    const sentences = piece.split(/(?<=[.!?])\s+/);
    let sBuf = "";
    for (const s of sentences) {
      if ((sBuf + " " + s).length > maxChars && sBuf) {
        further.push(sBuf.trim());
        sBuf = s;
      } else {
        sBuf = sBuf ? sBuf + " " + s : s;
      }
    }
    if (sBuf) further.push(sBuf.trim());
  }

  const finalOut: string[] = [];
  for (const piece of further) {
    if (piece.length <= hardMax) {
      finalOut.push(piece);
      continue;
    }
    for (let i = 0; i < piece.length; i += hardMax) {
      finalOut.push(piece.slice(i, i + hardMax));
    }
  }
  return finalOut;
}

export function markdownChunker(
  markdown: string,
  options: Partial<ChunkerOptions> = {},
): Chunk[] {
  const opts: ChunkerOptions = { ...DEFAULTS, ...options };
  const blocks = splitIntoBlocks(markdown);
  if (blocks.length === 0) return [];

  type Section = { heading?: string; bodies: Block[] };
  const sections: Section[] = [];
  let current: Section = { bodies: [] };
  for (const b of blocks) {
    if (b.type === "heading" && b.level <= 3) {
      if (current.bodies.length || current.heading) sections.push(current);
      current = { heading: b.text, bodies: [] };
    } else {
      current.bodies.push(b);
    }
  }
  if (current.bodies.length || current.heading) sections.push(current);

  const rawChunks: string[] = [];
  for (const sec of sections) {
    const headingLine = sec.heading ? `## ${sec.heading}\n\n` : "";
    const textParts: string[] = [];
    for (const b of sec.bodies) {
      if (b.type === "heading") {
        textParts.push(`${"#".repeat(Math.min(b.level, 6))} ${b.text}`);
      } else {
        textParts.push(b.text);
      }
    }
    const text = headingLine + textParts.join("\n\n");

    const tableBlocks = sec.bodies.filter((b) => b.type === "table");
    if (tableBlocks.length && sec.bodies.length === tableBlocks.length) {
      for (const t of tableBlocks) {
        const ttext = headingLine + t.text;
        if (ttext.length <= opts.hardMax) rawChunks.push(ttext);
        else
          for (const piece of splitLongText(ttext, opts.maxChars, opts.hardMax))
            rawChunks.push(piece);
      }
      continue;
    }

    if (text.length <= opts.maxChars) {
      rawChunks.push(text);
    } else {
      for (const piece of splitLongText(text, opts.maxChars, opts.hardMax)) {
        if (sec.heading && !piece.startsWith("## ")) {
          rawChunks.push(`## ${sec.heading}\n\n${piece}`);
        } else {
          rawChunks.push(piece);
        }
      }
    }
  }

  const merged: string[] = [];
  for (const c of rawChunks) {
    if (merged.length > 0 && merged[merged.length - 1].length < opts.minChars) {
      merged[merged.length - 1] = merged[merged.length - 1] + "\n\n" + c;
    } else {
      merged.push(c);
    }
  }

  if (opts.overlapChars <= 0) {
    return merged.filter((c) => c.trim().length > 0).map((text) => ({ text }));
  }
  const out: string[] = [];
  for (let i = 0; i < merged.length; i++) {
    if (i === 0) {
      out.push(merged[i]);
    } else {
      const prev = merged[i - 1];
      const overlap = prev.slice(Math.max(0, prev.length - opts.overlapChars));
      out.push(`[…] ${overlap}\n\n${merged[i]}`);
    }
  }
  return out.filter((c) => c.trim().length > 0).map((text) => ({ text }));
}
