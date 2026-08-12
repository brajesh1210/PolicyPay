/** 8-hour "keep me signed in" cookie. Survives NextAuth signOut. */

export const REMEMBER_COOKIE = "pp-stay";
export const REMEMBER_MAX_AGE = 8 * 60 * 60; // seconds
export const KEEP_INTENT_KEY = "pp-keep";

export function authSecret(): string {
  return process.env.NEXTAUTH_SECRET || "policypay-nextauth-dev-secret";
}

export function useSecureCookies(): boolean {
  const url = process.env.NEXTAUTH_URL || "";
  return url.startsWith("https://");
}

export function sessionCookieName(): string {
  return useSecureCookies()
    ? "__Secure-next-auth.session-token"
    : "next-auth.session-token";
}

export function rememberCookieOptions(maxAge = REMEMBER_MAX_AGE) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: useSecureCookies(),
    maxAge,
  };
}

export function safeCallbackPath(raw: string | null | undefined): string {
  if (!raw) return "/dashboard";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/dashboard";
  return raw;
}