import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: { signIn: "/login" },
});

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
