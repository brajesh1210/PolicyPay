import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { REMEMBER_COOKIE, authSecret } from "@/lib/remember";

export async function middleware(req: NextRequest) {
  const token = await getToken({ req, secret: authSecret() });
  const alive =
    !!token?.apiToken &&
    (!token.stayUntil || Date.now() < Number(token.stayUntil));

  if (alive) return NextResponse.next();

  const here = req.nextUrl.pathname + req.nextUrl.search;

  if (req.cookies.get(REMEMBER_COOKIE)?.value) {
    const restore = req.nextUrl.clone();
    restore.pathname = "/api/auth/restore";
    restore.search = "";
    restore.searchParams.set("callbackUrl", here);
    return NextResponse.redirect(restore);
  }

  const login = req.nextUrl.clone();
  login.pathname = "/login";
  login.search = "";
  login.searchParams.set("callbackUrl", here);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/transactions/:path*",
    "/approvals/:path*",
    "/agents/:path*",
    "/connect/:path*",
    "/policies/:path*",
    "/merchants/:path*",
    "/alerts/:path*",
    "/audit-logs/:path*",
    "/simulation/:path*",
    "/settings/:path*",
  ],
};