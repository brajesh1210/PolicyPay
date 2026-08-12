/** @type {import('next').NextConfig} */

// Browser never talks to Railway directly (DNS / extensions / CORS).
// /api/gateway/* is rewritten here to the real API origin.
const API_ORIGIN = (
  process.env.API_PROXY_TARGET ||
  process.env.NEXT_PUBLIC_API_URL ||
  "https://policypay-production.up.railway.app"
)
  .trim()
  .replace(/\/$/, "");

const safeOrigin =
  !API_ORIGIN || API_ORIGIN.startsWith("/") || /\/api\/gateway/i.test(API_ORIGIN)
    ? "https://policypay-production.up.railway.app"
    : API_ORIGIN;

const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: "/api/gateway/:path*",
        destination: `${safeOrigin}/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
