import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const passcode = process.env.APP_PASSCODE;
  if (!passcode) {
    return NextResponse.json({ ok: true });
  }
  const body = (await req.json().catch(() => ({}))) as { code?: string };
  if (body.code !== passcode) {
    return NextResponse.json({ error: "Wrong passcode" }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set("dr_auth", passcode, {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
