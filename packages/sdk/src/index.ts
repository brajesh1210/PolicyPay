/**
 * policypay — spend guard for AI agents.
 *
 * The whole point of this file: a developer should never have to know
 * the endpoint name, the header format, that `merchant` is an object,
 * or what an idempotency key is. They write one line before a purchase.
 *
 *   const ok = await pp.check({ amount: 4.99, vendor: "openai" });
 *   if (!ok.allowed) return;
 */

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type Decision = "ALLOW" | "DENY" | "REQUIRE_APPROVAL";

export interface PolicyCheck {
  check: string;
  passed: boolean;
  detail?: string;
}

export interface RiskFactor {
  factor: string;
  points: number;
  detail?: string;
}

export interface CheckOptions {
  /** How much this purchase costs, in USD. */
  amount: number;
  /** Who is being paid. "openai" or "api.openai.com" both work. */
  vendor: string;
  /** Free text — why the agent wants this. Shows up in the audit log. */
  why?: string;
  /** Alias for `why`, if you prefer. */
  purpose?: string;
  /** Currency code. Defaults to USDC. */
  currency?: string;
  /**
   * Duplicate-protection id, unique per purchase. Generated for you if
   * omitted. Reusing a key inside the guard window is rejected as a
   * DUPLICATE_INTENT — that is deliberate, it stops double-charging.
   */
  key?: string;
  /** Human-friendly merchant name for the dashboard. */
  vendorName?: string;
}

export interface CheckResult {
  /** true only when the payment may proceed right now. */
  allowed: boolean;
  /** true when a human has to approve before this can proceed. */
  needsApproval: boolean;
  decision: Decision;
  /** 0–100. Higher is riskier. */
  risk: number;
  /** Machine-readable codes, e.g. ["DAILY_BUDGET_EXCEEDED"]. */
  reasons: string[];
  /** One sentence you can print or log. */
  message: string;
  transactionId: string;
  approvalId?: string;
  checks: PolicyCheck[];
  riskBreakdown: RiskFactor[];
  /** Present when the gateway signs an x402 payment payload. */
  x402?: { signed_payload: string; network: string };
}

export interface PolicyPayOptions {
  /** Defaults to process.env.POLICYPAY_API_KEY */
  apiKey?: string;
  /** Defaults to process.env.POLICYPAY_AGENT_ID */
  agentId?: string;
  /** Defaults to process.env.POLICYPAY_URL, then the hosted gateway. */
  baseUrl?: string;
  /** Milliseconds before giving up on the gateway. Default 10000. */
  timeout?: number;
  /**
   * What to do if PolicyPay itself is unreachable.
   *  "closed" (default) — treat as DENY. Safe: no unguarded spending.
   *  "open"             — treat as ALLOW. Availability over control.
   */
  onGatewayError?: "closed" | "open";
  /** Print a one-line summary of every decision. Default false. */
  log?: boolean;
}

export class PolicyPayError extends Error {
  code: string;
  status?: number;
  constructor(code: string, message: string, status?: number) {
    super(message);
    this.name = "PolicyPayError";
    this.code = code;
    this.status = status;
  }
}

/** Thrown by `enforce()` when a payment is not allowed. */
export class SpendBlockedError extends Error {
  result: CheckResult;
  constructor(result: CheckResult) {
    super(result.message);
    this.name = "SpendBlockedError";
    this.result = result;
  }
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

const DEFAULT_URL = "https://policypay-production.up.railway.app";

/**
 * Accept anything a human would reasonably type and turn it into a domain.
 *   "openai"                  → "api.openai.com"
 *   "OpenAI"                  → "api.openai.com"
 *   "https://api.stripe.com/" → "api.stripe.com"
 *   "shady-payments.com"      → "shady-payments.com"
 */
const KNOWN: Record<string, string> = {
  openai: "api.openai.com",
  anthropic: "api.anthropic.com",
  claude: "api.anthropic.com",
  stripe: "api.stripe.com",
  github: "api.github.com",
  aws: "aws.amazon.com",
  vercel: "api.vercel.com",
  supabase: "api.supabase.com",
  replicate: "api.replicate.com",
  huggingface: "api-inference.huggingface.co",
  serpapi: "serpapi.com",
  twilio: "api.twilio.com",
};

export function normaliseVendor(input: string): string {
  const raw = String(input ?? "").trim();
  if (!raw) throw new PolicyPayError("BAD_VENDOR", "vendor is required");

  const lower = raw.toLowerCase();
  if (KNOWN[lower]) return KNOWN[lower];

  let s = lower.replace(/^[a-z]+:\/\//, ""); // strip scheme
  s = s.split("/")[0];                        // strip path
  s = s.split("?")[0].split("#")[0];
  s = s.replace(/:\d+$/, "");                 // strip port
  s = s.replace(/\.$/, "");

  if (!s) throw new PolicyPayError("BAD_VENDOR", `could not read a domain from "${raw}"`);
  return s.includes(".") ? s : `${s}.com`;
}

function newKey(): string {
  const g: any = globalThis as any;
  if (g.crypto?.randomUUID) return g.crypto.randomUUID();
  return `pp-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

function human(decision: Decision, amount: number, vendor: string, reasons: string[]): string {
  const money = `$${amount.toFixed(2)}`;
  const why = reasons.length ? ` (${reasons.join(", ")})` : "";
  if (decision === "ALLOW") return `Approved ${money} to ${vendor}`;
  if (decision === "REQUIRE_APPROVAL") return `${money} to ${vendor} is waiting for a human${why}`;
  return `Blocked ${money} to ${vendor}${why}`;
}

// ─────────────────────────────────────────────────────────────
// Client
// ─────────────────────────────────────────────────────────────

export class PolicyPay {
  private apiKey: string;
  private agentId: string;
  private baseUrl: string;
  private timeout: number;
  private failMode: "closed" | "open";
  private log: boolean;

  constructor(opts: PolicyPayOptions = {}) {
    const env = (typeof process !== "undefined" ? process.env : {}) as Record<string, string>;

    this.apiKey = opts.apiKey ?? env.POLICYPAY_API_KEY ?? "";
    this.agentId = opts.agentId ?? env.POLICYPAY_AGENT_ID ?? "";
    this.baseUrl = (opts.baseUrl ?? env.POLICYPAY_URL ?? DEFAULT_URL).replace(/\/+$/, "");
    this.timeout = opts.timeout ?? 10_000;
    this.failMode = opts.onGatewayError ?? "closed";
    this.log = opts.log ?? false;

    if (!this.apiKey) {
      throw new PolicyPayError(
        "NO_API_KEY",
        "No API key. Add POLICYPAY_API_KEY to your .env, or pass { apiKey } " +
          "to new PolicyPay(). Get one from your dashboard under Settings → API keys."
      );
    }
    if (!this.apiKey.startsWith("pp_live_")) {
      throw new PolicyPayError(
        "BAD_API_KEY",
        `API key should start with "pp_live_" — got "${this.apiKey.slice(0, 8)}…"`
      );
    }
    if (!this.agentId) {
      throw new PolicyPayError(
        "NO_AGENT_ID",
        "No agent id. Add POLICYPAY_AGENT_ID to your .env, or pass { agentId }. " +
          "It is shown next to the API key in your dashboard."
      );
    }
  }

  /**
   * Ask permission before spending. Never throws on a DENY — inspect
   * `.allowed` instead. Throws only on misconfiguration.
   */
  async check(opts: CheckOptions): Promise<CheckResult> {
    const amount = Number(opts.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new PolicyPayError("BAD_AMOUNT", `amount must be a positive number, got ${opts.amount}`);
    }

    const domain = normaliseVendor(opts.vendor);
    const body = {
      agent_id: this.agentId,
      merchant: { domain, ...(opts.vendorName ? { name: opts.vendorName } : {}) },
      amount_usd: amount,
      currency: opts.currency ?? "USDC",
      purpose: opts.why ?? opts.purpose ?? "",
      idempotency_key: opts.key ?? newKey(),
    };

    let json: any;
    try {
      json = await this.post("/v1/authorize-payment", body);
    } catch (err: any) {
      if (err instanceof PolicyPayError && err.code !== "GATEWAY_UNREACHABLE") throw err;

      // Gateway down. Decide by policy, do not crash the agent.
      const allowed = this.failMode === "open";
      const result: CheckResult = {
        allowed,
        needsApproval: false,
        decision: allowed ? "ALLOW" : "DENY",
        risk: 0,
        reasons: ["GATEWAY_UNREACHABLE"],
        message: allowed
          ? `PolicyPay unreachable — allowing ${`$${amount.toFixed(2)}`} to ${domain} (fail-open)`
          : `PolicyPay unreachable — blocking $${amount.toFixed(2)} to ${domain} (fail-closed)`,
        transactionId: "",
        checks: [],
        riskBreakdown: [],
      };
      if (this.log) console.log(`[policypay] ${result.message}`);
      return result;
    }

    const d = json.data ?? {};
    const decision: Decision = d.decision ?? "DENY";
    const reasons: string[] = d.reason_codes ?? [];

    const result: CheckResult = {
      allowed: decision === "ALLOW",
      needsApproval: decision === "REQUIRE_APPROVAL",
      decision,
      risk: d.risk_score ?? 0,
      reasons,
      message: human(decision, amount, domain, reasons),
      transactionId: d.transaction_id ?? "",
      approvalId: d.approval_id,
      checks: d.policy_checks ?? [],
      riskBreakdown: d.risk_breakdown ?? [],
      x402: d.x402_payment,
    };

    if (this.log) console.log(`[policypay] ${result.message}`);
    return result;
  }

  /**
   * Same as check(), but throws SpendBlockedError unless the payment is
   * allowed. Handy when you want a purchase to simply not happen.
   */
  async enforce(opts: CheckOptions): Promise<CheckResult> {
    const r = await this.check(opts);
    if (!r.allowed) throw new SpendBlockedError(r);
    return r;
  }

  /**
   * Wrap a function so it only runs if the spend is approved.
   *
   *   const data = await pp.guard(
   *     { amount: 4.99, vendor: "openai" },
   *     () => fetch(url).then(r => r.json())
   *   );
   */
  async guard<T>(opts: CheckOptions, fn: () => Promise<T> | T): Promise<T> {
    await this.enforce(opts);
    return await fn();
  }

  /**
   * Dry run. Asks what *would* happen without recording anything or
   * touching any counters. Requires a dashboard token, not an agent key.
   */
  async preview(opts: CheckOptions & { token: string }): Promise<CheckResult> {
    const domain = normaliseVendor(opts.vendor);
    const json = await this.post(
      "/v1/simulate",
      {
        agent_id: this.agentId,
        merchant: { domain, category: "api", ...(opts.vendorName ? { name: opts.vendorName } : {}) },
        amount_usd: Number(opts.amount),
        currency: opts.currency ?? "USDC",
        purpose: opts.why ?? opts.purpose ?? "",
        idempotency_key: opts.key ?? newKey(),
      },
      `Bearer ${opts.token}`
    );
    const d = json.data ?? {};
    const decision: Decision = d.decision ?? "DENY";
    return {
      allowed: decision === "ALLOW",
      needsApproval: decision === "REQUIRE_APPROVAL",
      decision,
      risk: d.risk_score ?? 0,
      reasons: d.reason_codes ?? [],
      message: human(decision, Number(opts.amount), domain, d.reason_codes ?? []),
      transactionId: "",
      checks: d.policy_checks ?? [],
      riskBreakdown: d.risk_breakdown ?? [],
    };
  }

  /** Is the gateway up? Never throws. */
  async ping(): Promise<boolean> {
    try {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), this.timeout);
      const res = await fetch(`${this.baseUrl}/health`, { signal: ctl.signal });
      clearTimeout(t);
      return res.ok;
    } catch {
      return false;
    }
  }

  // ── internals ──────────────────────────────────────────────

  private async post(path: string, body: unknown, auth?: string): Promise<any> {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), this.timeout);

    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}${path}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: auth ?? `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: ctl.signal,
      });
    } catch (err: any) {
      throw new PolicyPayError(
        "GATEWAY_UNREACHABLE",
        `Could not reach PolicyPay at ${this.baseUrl} (${err?.message ?? "network error"})`
      );
    } finally {
      clearTimeout(timer);
    }

    let json: any = null;
    try {
      json = await res.json();
    } catch {
      /* non-JSON body */
    }

    if (!res.ok || json?.success === false) {
      const code = json?.error?.code ?? `HTTP_${res.status}`;
      let msg = json?.error?.message ?? `Request failed with status ${res.status}`;

      // Turn the two mistakes everyone makes into readable advice.
      if (code === "INVALID_API_KEY") {
        msg =
          "PolicyPay rejected the API key. Check POLICYPAY_API_KEY in your .env — " +
          "it should look like pp_live_… and must not be revoked.";
      } else if (code === "FORBIDDEN" && /does not match/i.test(msg)) {
        msg =
          "POLICYPAY_AGENT_ID does not belong to this API key. Copy both from the " +
          "same agent in your dashboard.";
      }
      throw new PolicyPayError(code, msg, res.status);
    }

    return json;
  }
}

/** Convenience: a client built from environment variables. */
export function createClient(opts?: PolicyPayOptions): PolicyPay {
  return new PolicyPay(opts);
}

export default PolicyPay;
