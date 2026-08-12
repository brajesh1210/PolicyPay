import axios, { AxiosError, AxiosRequestConfig } from "axios";
import { getSession, signOut } from "next-auth/react";

const rawBaseUrl =
  process.env.NEXT_PUBLIC_API_URL || "https://policypay-production.up.railway.app";

/** Real API origin — used for display (Connect / Settings) and server-side calls. */
export const API_BASE = rawBaseUrl.replace(/\/$/, "");

/**
 * Same-origin proxy. next.config.js rewrites `/api/gateway/*` to the backend.
 *
 * The browser must not call the Railway host directly: some networks, DNS
 * resolvers and extensions fail with ERR_NAME_NOT_RESOLVED and every page
 * then loads empty. Server-side code (NextAuth) still hits API_BASE.
 */
export const BROWSER_API_BASE = "/api/gateway";

function clientBaseUrl(): string {
  if (typeof window !== "undefined") return BROWSER_API_BASE;
  return API_BASE;
}

const client = axios.create({
  baseURL: clientBaseUrl(),
  headers: { "Content-Type": "application/json" },
  timeout: 20000,
});

/** '/agents' and '/v1/agents' both resolve to '/v1/agents' */
function normalizeUrl(url: string): string {
  const path = url.startsWith("/") ? url : `/${url}`;
  return path.startsWith("/v1/") ? path : `/v1${path}`;
}

/* ── token cache so we don't hit /api/auth/session on every call ── */
let cachedToken: string | null = null;
let cachedAt = 0;
const TOKEN_TTL = 30000;

async function getApiToken(force = false): Promise<string | null> {
  const now = Date.now();
  if (!force && cachedToken && now - cachedAt < TOKEN_TTL) return cachedToken;

  const session = await getSession();
  cachedToken = (session as any)?.apiToken ?? null;
  cachedAt = now;
  return cachedToken;
}

export function clearApiTokenCache() {
  cachedToken = null;
  cachedAt = 0;
}

client.interceptors.request.use(async (config) => {
  // Always same-origin in the browser, even if this module first loaded on the server.
  if (typeof window !== "undefined") config.baseURL = BROWSER_API_BASE;
  if (config.url) config.url = normalizeUrl(config.url);
  const token = await getApiToken();
  if (token) config.headers.set("Authorization", `Bearer ${token}`);
  return config;
});

client.interceptors.response.use(
  (response) => response.data,
  async (error: AxiosError<any>) => {
    const status = error.response?.status ?? 0;
    const original = error.config as
      | (AxiosRequestConfig & { _retried?: boolean })
      | undefined;

    // one retry with a freshly fetched token
    if (status === 401 && original && !original._retried) {
      original._retried = true;
      const fresh = await getApiToken(true);

      if (fresh) {
        return client.request({
          ...original,
          headers: { ...(original.headers as any), Authorization: `Bearer ${fresh}` },
        });
      }

      if (
        typeof window !== "undefined" &&
        !window.location.pathname.startsWith("/login")
      ) {
        clearApiTokenCache();
        await signOut({ callbackUrl: "/login" });
      }
    }

    const message =
      error.response?.data?.error?.message ||
      error.message ||
      "Something went wrong.";
    const code = error.response?.data?.error?.code || "UNKNOWN_ERROR";

    const err = new Error(message) as Error & { code: string; status: number };
    err.code = code;
    err.status = status;
    throw err;
  }
);

export default client;

/* ── helpers ── */
export type Envelope<T> = { success: boolean; data: T; meta?: Meta };
export type Meta = { total: number; page: number; limit: number; totalPages?: number };

/** Returns just `data` from the { success, data } envelope. */
export async function apiGet<T = any>(
  url: string,
  params?: Record<string, unknown>
): Promise<T> {
  const res: any = await client.get(url, { params });
  return res?.data !== undefined ? res.data : res;
}

/** Returns `{ data, meta }` — use for paginated lists. */
export async function apiList<T = any>(
  url: string,
  params?: Record<string, unknown>
): Promise<{ data: T; meta?: Meta }> {
  const res: any = await client.get(url, { params });
  if (res && res.data !== undefined) return { data: res.data, meta: res.meta };
  return { data: res as T };
}

export async function apiSend<T = any>(
  method: "post" | "put" | "patch" | "delete",
  url: string,
  body?: unknown
): Promise<T> {
  const res: any = await client.request({ method, url, data: body });
  return res?.data !== undefined ? res.data : res;
}