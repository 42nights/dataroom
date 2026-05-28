import { NextResponse, type NextRequest } from "next/server";

// Optional shared passcode gate. Set APP_PASSCODE in .env.local to enable.
// Set the cookie via /unlock. Leave APP_PASSCODE unset to bypass entirely.
export function proxy(req: NextRequest) {
  const passcode = process.env.APP_PASSCODE;
  if (!passcode) return NextResponse.next();

  const { pathname } = req.nextUrl;
  if (
    pathname.startsWith("/unlock") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  const cookie = req.cookies.get("dr_auth")?.value;
  if (cookie === passcode) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/unlock";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!api/unlock).*)"],
};
