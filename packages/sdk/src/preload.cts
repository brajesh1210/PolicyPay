/**
 * Injected via --require by `policypay guard`.
 *
 * Patches global fetch and node:http(s).request so that any outbound
 * call to a *paid* vendor is authorized by PolicyPay first. The target
 * program is not modified in any way.
 *
 * Design notes
 *  - Only known paid vendors are intercepted. Everything else (localhost,
 *    package registries, telemetry) passes straight through, otherwise we
 *    would ask permission for every unrelated request.
 *  - Requests to PolicyPay itself are never intercepted (no recursion).
 *  - A blocked call rejects the way a network failure would, so agents
 *    that already handle errors keep working.
 */

type Decision = "ALLOW" | "DENY" | "REQUIRE_APPROVAL";

const API_KEY = process.env.POLICYPAY_API_KEY || "";
const AGENT_ID = process.env.POLICYPAY_AGENT_ID || "";
const BASE = (process.env.POLICYPAY_URL || "https://policypay-production.up.railway.app").replace(/\/+$/, "");
const DRY = process.env.POLICYPAY_GUARD_DRY === "1";
const OPEN = process.env.POLICYPAY_GUARD_OPEN === "1";
const HARD_LIMIT = process.env.POLICYPAY_GUARD_LIMIT ? Number(process.env.POLICYPAY_GUARD_LIMIT) : null;

const c = {
  d: (s: string) => `\x1b[2m${s}\x1b[0m`,
  g: (s: string) => `\x1b[32m${s}\x1b[0m`,
  r: (s: string) => `\x1b[31m${s}\x1b[0m`,
  y: (s: string) => `\x1b[33m${s}\x1b[0m`,
  b: (s: string) => `\x1b[1m${s}\x1b[0m`,
};

/**
 * Vendors we consider "paid". Each entry maps a hostname pattern to an
 * estimated cost per call — the guard cannot know the real invoice, so
 * it authorizes an estimate. Agents that know the exact figure should
 * use the SDK directly.
 */
const PAID: Array<{ match: RegExp; domain: string; est: number; label: string }> = [
  { match: /(^|\.)openai\.com$/,            domain: "api.openai.com",            est: 0.05, label: "OpenAI" },
  { match: /(^|\.)anthropic\.com$/,         domain: "api.anthropic.com",         est: 0.05, label: "Anthropic" },
  { match: /(^|\.)replicate\.com$/,         domain: "api.replicate.com",         est: 0.10, label: "Replicate" },
  { match: /(^|\.)huggingface\.co$/,        domain: "api-inference.huggingface.co", est: 0.02, label: "HuggingFace" },
  { match: /(^|\.)stripe\.com$/,            domain: "api.stripe.com",            est: 1.00, label: "Stripe" },
  { match: /(^|\.)twilio\.com$/,            domain: "api.twilio.com",            est: 0.02, label: "Twilio" },
  { match: /(^|\.)serpapi\.com$/,           domain: "serpapi.com",               est: 0.01, label: "SerpAPI" },
  { match: /(^|\.)tavily\.com$/,            domain: "api.tavily.com",            est: 0.01, label: "Tavily" },
  { match: /(^|\.)firecrawl\.dev$/,         domain: "api.firecrawl.dev",         est: 0.01, label: "Firecrawl" },
  { match: /(^|\.)browserless\.io$/,        domain: "chrome.browserless.io",     est: 0.02, label: "Browserless" },
  { match: /(^|\.)elevenlabs\.io$/,         domain: "api.elevenlabs.io",         est: 0.05, label: "ElevenLabs" },
  { match: /(^|\.)deepgram\.com$/,          domain: "api.deepgram.com",          est: 0.02, label: "Deepgram" },
  { match: /(^|\.)pinecone\.io$/,           domain: "api.pinecone.io",           est: 0.01, label: "Pinecone" },
  { match: /(^|\.)mistral\.ai$/,            domain: "api.mistral.ai",            est: 0.03, label: "Mistral" },
  { match: /(^|\.)cohere\.(com|ai)$/,       domain: "api.cohere.com",            est: 0.03, label: "Cohere" },
  { match: /(^|\.)groq\.com$/,              domain: "api.groq.com",              est: 0.02, label: "Groq" },
  { match: /(^|\.)perplexity\.ai$/,         domain: "api.perplexity.ai",         est: 0.03, label: "Perplexity" },
  // demo vendors, so the hackathon walkthrough works end to end
  { match: /(^|\.)trusted-api\.com$/,       domain: "trusted-api.com",           est: 1.00, label: "Trusted API" },
  { match: /(^|\.)data-provider\.xyz$/,     domain: "data-provider.xyz",         est: 2.00, label: "Data Provider" },
  { match: /(^|\.)unknown-service\.xyz$/,   domain: "unknown-service.xyz",       est: 1.00, label: "Unknown Service" },
  { match: /(^|\.)shady-payments\.com$/,    domain: "shady-payments.com",        est: 1.00, label: "Shady Payments" },
];

function classify(hostname: string) {
  const h = (hostname || "").toLowerCase();
  if (!h) return null;
  if (BASE.includes(h)) return null;                 // never guard ourselves
  if (h === "localhost" || h === "127.0.0.1" || h === "::1") return null;
  return PAID.find((p) => p.match.test(h)) || null;
}

const seen = new Map<string, number>();

function newKey() {
  const g: any = globalThis as any;
  return g.crypto?.randomUUID ? g.crypto.randomUUID() : `pp-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

/** Ask the gateway. Uses the *original* fetch so we never recurse. */
async function authorize(
  rawFetch: typeof fetch,
  vendor: { domain: string; est: number; label: string },
  url: string
): Promise<{ decision: Decision; risk: number; reasons: string[]; amount: number }> {
  const amount = vendor.est;

  if (HARD_LIMIT != null && amount > HARD_LIMIT) {
    return { decision: "DENY", risk: 100, reasons: ["OVER_LOCAL_LIMIT"], amount };
  }

  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 10_000);
    const res = await rawFetch(`${BASE}/v1/authorize-payment`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${API_KEY}` },
      body: JSON.stringify({
        agent_id: AGENT_ID,
        merchant: { domain: vendor.domain, name: vendor.label },
        amount_usd: amount,
        currency: "USDC",
        purpose: `auto-guarded call to ${url.slice(0, 120)}`,
        idempotency_key: newKey(),
      }),
      signal: ctl.signal,
    });
    clearTimeout(t);
    const json: any = await res.json().catch(() => null);
    const d = json?.data;
    if (!d) {
      const code = json?.error?.code || `HTTP_${res.status}`;
      return { decision: OPEN ? "ALLOW" : "DENY", risk: 0, reasons: [code], amount };
    }
    return {
      decision: d.decision as Decision,
      risk: d.risk_score ?? 0,
      reasons: d.reason_codes ?? [],
      amount,
    };
  } catch {
    return {
      decision: OPEN ? "ALLOW" : "DENY",
      risk: 0,
      reasons: ["GATEWAY_UNREACHABLE"],
      amount,
    };
  }
}

function report(v: { label: string }, r: { decision: Decision; risk: number; reasons: string[]; amount: number }) {
  const money = `$${r.amount.toFixed(2)}`;
  const tag =
    r.decision === "ALLOW" ? c.g("ALLOW  ")
    : r.decision === "REQUIRE_APPROVAL" ? c.y("HOLD   ")
    : c.r("BLOCK  ");
  const why = r.reasons.length ? c.d(` ${r.reasons.join(", ")}`) : "";
  const dry = DRY ? c.d(" [dry-run]") : "";
  process.stderr.write(`  ${c.d("policypay")} ${tag} ${money.padStart(7)} ${v.label}${why}${dry}\n`);
}

function blockedError(v: { label: string }, r: { reasons: string[] }) {
  const e: any = new Error(
    `PolicyPay blocked this payment to ${v.label}` +
      (r.reasons.length ? ` (${r.reasons.join(", ")})` : "")
  );
  e.code = "POLICYPAY_BLOCKED";
  e.policypay = r;
  return e;
}

// ── patch global fetch ────────────────────────────────────────
const rawFetch: typeof fetch = globalThis.fetch?.bind(globalThis);

if (rawFetch) {
  globalThis.fetch = async function (input: any, init?: any) {
    let url = "";
    try {
      url = typeof input === "string" ? input : input?.url ?? String(input);
    } catch {
      /* ignore */
    }

    let host = "";
    try {
      host = new URL(url).hostname;
    } catch {
      /* relative URL */
    }

    const vendor = classify(host);
    if (!vendor) return rawFetch(input, init);

    const r = await authorize(rawFetch, vendor, url);
    report(vendor, r);
    seen.set(vendor.label, (seen.get(vendor.label) || 0) + 1);

    if (!DRY && r.decision !== "ALLOW") throw blockedError(vendor, r);
    return rawFetch(input, init);
  } as any;
}

// ── patch http(s).request ─────────────────────────────────────
for (const mod of ["http", "https"] as const) {
  let lib: any;
  try {
    lib = require(`node:${mod}`);
  } catch {
    continue;
  }
  const origRequest = lib.request;
  const origGet = lib.get;

  const wrap = (orig: any) =>
    function (this: any, ...args: any[]) {
      let host = "";
      let full = "";
      try {
        const a0 = args[0];
        if (typeof a0 === "string") {
          const u = new URL(a0);
          host = u.hostname;
          full = a0;
        } else if (a0 instanceof URL) {
          host = a0.hostname;
          full = a0.toString();
        } else if (a0 && typeof a0 === "object") {
          host = a0.hostname || a0.host || "";
          full = `${mod}://${host}${a0.path || ""}`;
        }
      } catch {
        /* ignore */
      }

      const vendor = classify(String(host).split(":")[0]);
      if (!vendor) return orig.apply(this, args);

      // Return a stand-in request object; decide asynchronously.
      const { PassThrough } = require("node:stream");
      const EventEmitter = require("node:events");
      const fake: any = new EventEmitter();
      const body = new PassThrough();
      fake.write = body.write.bind(body);
      fake.setHeader = () => fake;
      fake.getHeader = () => undefined;
      fake.removeHeader = () => fake;
      fake.setTimeout = () => fake;
      fake.abort = () => {};
      fake.destroy = () => {};
      fake.end = function (...endArgs: any[]) {
        body.end(...endArgs);
        authorize(rawFetch, vendor, full).then((r) => {
          report(vendor, r);
          if (!DRY && r.decision !== "ALLOW") {
            fake.emit("error", blockedError(vendor, r));
            return;
          }
          const real = orig.apply(this, args);
          real.on("response", (res: any) => fake.emit("response", res));
          real.on("error", (e: any) => fake.emit("error", e));
          body.pipe(real);
        });
        return fake;
      };
      return fake;
    };

  lib.request = wrap(origRequest);
  lib.get = function (this: any, ...args: any[]) {
    const req = lib.request.apply(this, args);
    req.end();
    return req;
  };
}

// ── summary on exit ───────────────────────────────────────────
process.on("exit", () => {
  if (!seen.size) return;
  const total = [...seen.values()].reduce((a, b) => a + b, 0);
  process.stderr.write(
    `\n  ${c.d("policypay")} ${c.b(String(total))} payment ${total === 1 ? "request" : "requests"} checked ` +
      c.d(`(${[...seen.entries()].map(([k, v]) => `${k}×${v}`).join(", ")})`) +
      `\n`
  );
});

export {};
