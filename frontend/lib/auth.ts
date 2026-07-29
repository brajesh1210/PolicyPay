import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import jwt from "jsonwebtoken";

const API_URL = (
  process.env.NEXT_PUBLIC_API_URL || "https://policypay-production.up.railway.app"
).replace(/\/$/, "");

const API_JWT_SECRET =
  process.env.API_JWT_SECRET || "policypay-dev-secret-change-me";

/**
 * Google sign-in mints a backend token locally, signed with the same secret
 * the backend verifies with. The backend trusts any correctly signed token,
 * so a Google user does not need a row in the users table.
 */
function mintApiToken(userId: string, email: string, role = "ADMIN") {
  return jwt.sign({ userId, email, role }, API_JWT_SECRET, { expiresIn: "24h" });
}

const providers: NextAuthOptions["providers"] = [
  CredentialsProvider({
    name: "Credentials",
    credentials: {
      email: { label: "Email", type: "text" },
      password: { label: "Password", type: "password" },
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
    async jwt({ token, user, account }) {
      // Credentials login — the backend already handed us a token.
      if (user && (user as any).apiToken) {
        token.userId = (user as any).id;
        token.role = (user as any).role;
        token.apiToken = (user as any).apiToken;
      }

      // Google login — mint one ourselves.
      if (account?.provider === "google" && !token.apiToken) {
        const email = token.email || "unknown@google";
        token.userId = "google:" + email;
        token.role = "ADMIN";
        token.apiToken = mintApiToken(token.userId as string, email as string);
      }

      return token;
    },

    async session({ session, token }) {
      session.apiToken = token.apiToken as string;
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
