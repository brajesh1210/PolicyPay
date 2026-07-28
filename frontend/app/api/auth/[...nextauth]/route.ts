import NextAuth, { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { SuccessEnvelope } from "@policypay/contracts";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        try {
          const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/v1/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: credentials?.email,
              password: credentials?.password,
            }),
          });

          const json = await res.json();

          if (!res.ok || json.success !== true) {
            return null;
          }

          const { user, apiToken } = json.data;

          return {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            apiToken: apiToken,
          };
        } catch (error) {
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, account }) {
      if (user && (user as any).apiToken) {
        token.userId = (user as any).id;
        token.role = (user as any).role;
        token.apiToken = (user as any).apiToken;
      }

      if (account?.provider === "google" && !token.apiToken) {
        const jwtLib = await import("jsonwebtoken");
        token.userId = "google:" + token.email;
        token.role = "ADMIN";
        token.apiToken = jwtLib.default.sign(
          { userId: token.userId, email: token.email, role: "ADMIN" },
          process.env.API_JWT_SECRET as string,
          { expiresIn: "24h" }
        );
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
  secret: process.env.NEXTAUTH_SECRET,
};

// Only add Google if configured
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  authOptions.providers.push(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    })
  );
}

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };