import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    apiToken: string;
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      role: string;
    };
  }

  interface User {
    id: string;
    role: string;
    apiToken: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId: string;
    role: string;
    apiToken: string;
  }
}