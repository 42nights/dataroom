import { NextResponse } from "next/server";
import { ensureSchema } from "@/lib/db/ensure";
import { complianceSummary } from "@/lib/compliance";

export const runtime = "nodejs";

export async function GET() {
  ensureSchema();
  return NextResponse.json(complianceSummary());
}
