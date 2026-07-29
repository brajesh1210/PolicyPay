import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

const API_URL = (
  process.env.NEXT_PUBLIC_API_URL || "https://policypay-production.up.railway.app"
).replace(/\/$/, "");

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt", maxAge: 24 * 60 * 60 },
  providers: [
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
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user && (user as any).apiToken) {
        token.userId = (user as any).id;
        token.role = (user as any).role;
        token.apiToken = (user as any).apiToken;
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
  pages: { signIn: "/login" },
  secret: process.env.NEXTAUTH_SECRET || "policypay-nextauth-dev-secret",
};
