import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    apiToken?: string;
    keepSignedIn?: boolean;
    stayUntil?: number;
    user: {
      id?: string;
      role?: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }

  interface User {
    role?: string;
    apiToken?: string;
    keepSignedIn?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    role?: string;
    apiToken?: string;
    keepSignedIn?: boolean;
    stayUntil?: number;
  }
}