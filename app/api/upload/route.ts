import { NextRequest, NextResponse } from "next/server";
import { ensureSchema } from "@/lib/db/ensure";
import { ingestFile } from "@/lib/ingest";
import { MAX_UPLOAD_BYTES } from "@/lib/constants";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  ensureSchema();

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      {
        error: `File too large. Max ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)}MB.`,
      },
      { status: 400 },
    );
  }
  const titleRaw = form.get("title");
  const title = typeof titleRaw === "string" ? titleRaw.trim() : undefined;

  const bytes = Buffer.from(await file.arrayBuffer());

  // Fire-and-forget would be wrong: API routes need to await to keep the
  // process alive for the embed/parse work in dev. Await the full ingest.
  const result = await ingestFile({
    bytes,
    originalFilename: file.name,
    mime: file.type || "application/octet-stream",
    title: title || undefined,
  });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error, documentId: result.documentId },
      { status: 500 },
    );
  }
  return NextResponse.json(result);
}
