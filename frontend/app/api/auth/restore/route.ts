import { NextRequest, NextResponse } from "next/server";
import { encode, decode } from "next-auth/jwt";
import {
  REMEMBER_COOKIE,
  REMEMBER_MAX_AGE,
  authSecret,
  rememberCookieOptions,
  safeCallbackPath,
  sessionCookieName,
  useSecureCookies,
} from "@/lib/remember";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const safe = safeCallbackPath(req.nextUrl.searchParams.get("callbackUrl"));
  const login = new URL("/login", req.url);
  login.searchParams.set("callbackUrl", safe);

  const raw = req.cookies.get(REMEMBER_COOKIE)?.value;
  if (!raw) return NextResponse.redirect(login);

  const payload = await decode({ token: raw, secret: authSecret() });
  const expired =
    !payload?.apiToken ||
    !payload.userId ||
    (payload.stayUntil != null && Date.now() > Number(payload.stayUntil));

  if (expired) {
    const res = NextResponse.redirect(login);
    res.cookies.set(REMEMBER_COOKIE, "", rememberCookieOptions(0));
    return res;
  }

  const remaining = payload.stayUntil
    ? Math.max(60, Math.floor((Number(payload.stayUntil) - Date.now()) / 1000))
    : REMEMBER_MAX_AGE;

  const sessionToken = await encode({
    token: {
      userId: payload.userId,
      role: payload.role,
      apiToken: payload.apiToken,
      email: payload.email,
      name: payload.name,
      keepSignedIn: true,
      stayUntil: payload.stayUntil,
    },
    secret: authSecret(),
    maxAge: remaining,
  });

  const res = NextResponse.redirect(new URL(safe, req.url));
  res.cookies.set(sessionCookieName(), sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: useSecureCookies(),
    maxAge: remaining,
  });
  return res;
}