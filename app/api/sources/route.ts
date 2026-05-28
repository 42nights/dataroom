import { NextResponse } from "next/server";
import { ensureSchema } from "@/lib/db/ensure";
import { listDocuments } from "@/lib/ingest";

export const runtime = "nodejs";

export async function GET() {
  ensureSchema();
  return NextResponse.json({ sources: listDocuments() });
}
