export { default } from "next-auth/middleware";

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/transactions/:path*",
    "/approvals/:path*",
    "/agents/:path*",
    "/policies/:path*",
    "/merchants/:path*",
    "/alerts/:path*",
    "/audit-logs/:path*",
    "/simulation/:path*",
    "/settings/:path*",
  ],
};
