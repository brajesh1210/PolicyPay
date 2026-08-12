import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
const API_URL = (
  process.env.NEXT_PUBLIC_API_URL || "https://policypay-production.up.railway.app"
).replace(/\/$/, "");

/**
 * Google sign-in exchanges the verified email for a real backend account.
 * The backend creates the user and their workspace on first sign-in, so a
 * Google user owns agents and policies just like a password user does.
 */
async function exchangeGoogleForApiToken(email: string, name?: string | null) {
  const res = await fetch(`${API_URL}/v1/auth/oauth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, name: name ?? undefined }),
  });
  const json: any = await res.json().catch(() => null);
  if (!res.ok || json?.success !== true || !json.data?.apiToken) {
    console.error("[auth] google exchange failed:", res.status, json?.error?.message);
    return null;
  }
  return { userId: json.data.user.id as string, apiToken: json.data.apiToken as string,
           role: json.data.user.role as string };
}

const providers: NextAuthOptions["providers"] = [
  CredentialsProvider({
    name: "Credentials",
    credentials: {
      email: { label: "Email", type: "text" },
      password: { label: "Password", type: "password" },
      keepSignedIn: { label: "Keep me signed in", type: "text" },
    },
    async authorize(credentials) {
      if (!credentials?.email || !credentials?.password) return null;

      try {
        const res = await fetch(`${API_URL}/v1/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: credentials.email,
            password: credentials.password,
          }),
        });

        const json: any = await res.json().catch(() => null);

        if (!res.ok || !json || json.success !== true || !json.data?.apiToken) {
          console.error(
            "[auth] login failed:",
            res.status,
            json?.error?.message ?? "no message"
          );
          return null;
        }

        const { user, apiToken } = json.data;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          apiToken,
          keepSignedIn: credentials.keepSignedIn === "1",
        } as any;
      } catch (err) {
        console.error("[auth] login threw:", err);
        return null;
      }
    },
  }),
];

// Google is optional — the app still builds and runs without the env vars.
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: { prompt: "select_account" },
      },
    })
  );
}

export const googleEnabled = Boolean(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
);

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt", maxAge: 24 * 60 * 60 },
  providers,
  callbacks: {
    async jwt({ token, user, account, trigger, session }) {
      if (user && (user as any).apiToken) {
        token.userId = (user as any).id;
        token.role = (user as any).role;
        token.apiToken = (user as any).apiToken;
        token.keepSignedIn = !!(user as any).keepSignedIn;
        if (token.keepSignedIn) {
          token.stayUntil = Date.now() + 8 * 60 * 60 * 1000;
        } else {
          delete token.stayUntil;
        }
      }

      if (account?.provider === "google" && !token.apiToken && token.email) {
        const res = await exchangeGoogleForApiToken(token.email, token.name);
        if (res) {
          token.userId = res.userId;
          token.role = res.role;
          token.apiToken = res.apiToken;
        }
      }

      if (trigger === "update" && session) {
        if (session.stayUntil) {
          token.keepSignedIn = true;
          token.stayUntil = session.stayUntil;
        }
        if (session.keepSignedIn === false) {
          token.keepSignedIn = false;
          delete token.stayUntil;
        }
      }

      if (token.stayUntil && Date.now() > Number(token.stayUntil)) {
        return {};
      }

      return token;
    },

    async session({ session, token }) {
      session.apiToken = token.apiToken as string;
      session.keepSignedIn = !!token.keepSignedIn;
      session.stayUntil = token.stayUntil as number | undefined;
      session.user = {
        ...session.user,
        id: token.userId as string,
        role: token.role as string,
      };
      return session;
    },
  },
  pages: { signIn: "/login", error: "/login" },
  secret: process.env.NEXTAUTH_SECRET || "policypay-nextauth-dev-secret",
};