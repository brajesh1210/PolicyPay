import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { cookies } from "next/headers";
import { encode } from "next-auth/jwt";
import { authOptions } from "@/lib/auth";
import {
  REMEMBER_COOKIE,
  REMEMBER_MAX_AGE,
  authSecret,
  rememberCookieOptions,
} from "@/lib/remember";

export const dynamic = "force-dynamic";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.apiToken || !session.user?.id) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const stayUntil = Date.now() + REMEMBER_MAX_AGE * 1000;
  const token = await encode({
    token: {
      userId: session.user.id,
      role: session.user.role,
      apiToken: session.apiToken,
      email: session.user.email,
      name: session.user.name,
      keepSignedIn: true,
      stayUntil,
    },
    secret: authSecret(),
    maxAge: REMEMBER_MAX_AGE,
  });

  cookies().set(REMEMBER_COOKIE, token, rememberCookieOptions());
  return NextResponse.json({ ok: true, stayUntil });
}

export async function DELETE() {
  cookies().set(REMEMBER_COOKIE, "", rememberCookieOptions(0));
  return NextResponse.json({ ok: true });
}