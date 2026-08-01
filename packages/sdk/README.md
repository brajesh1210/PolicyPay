# policypay

Spend guard for AI agents. One line before every purchase.

Your agent asks PolicyPay for permission before it spends money. PolicyPay
checks it against your policy — budgets, merchant allowlists, rate limits,
risk scoring — and answers **allow**, **block**, or **ask a human**.

```js
const ok = await pp.check({ amount: 4.99, vendor: "openai" });
if (!ok.allowed) return;        // that's the whole integration
```

---

## Install

```bash
npm install policypay
```

Add two lines to your `.env`:

```
POLICYPAY_API_KEY=pp_live_...
POLICYPAY_AGENT_ID=...
```

Both are on your dashboard under **Settings → API keys**.

Check it works:

```bash
npx policypay test
```

```
  ✓ POLICYPAY_API_KEY          pp_live_a3cb…
  ✓ POLICYPAY_AGENT_ID         cms36q3ez0005su8ruhidbwl7
  ✓ gateway reachable
  ✓ authorization works        ALLOW · risk 0

  All good.
```

---

## Two ways to use it

### 1. In your code

Put one check in front of anything that costs money.

```js
import { PolicyPay } from "policypay";

const pp = new PolicyPay();

const ok = await pp.check({
  amount: 4.99,
  vendor: "openai",
  why: "GPT-4 calls for the summarisation step",
});

if (!ok.allowed) {
  console.log(ok.message);   // "Blocked $4.99 to api.openai.com (DAILY_BUDGET_EXCEEDED)"
  return;
}

// safe to spend
const res = await fetch("https://api.openai.com/v1/chat/completions", { ... });
```

### 2. Without touching your code

Wrap the command you already run. PolicyPay sits in front of every outbound
call to a paid vendor.

```bash
npx policypay guard -- node agent.js
```

```
  ● PolicyPay guard active  fail-closed
  running: node agent.js

agent: I need some OpenAI tokens
  policypay ALLOW     $0.05 OpenAI
agent:   got HTTP 200, continuing

agent: I need data from a shady vendor
  policypay BLOCK     $1.00 Shady Payments  MERCHANT_NOT_ALLOWED
agent:   could not: PolicyPay blocked this payment to Shady Payments

  policypay 2 payment requests checked (OpenAI×1, Shady Payments×1)
```

Works with anything that runs on Node — your own scripts, `npm run`, or a
coding agent. Requests to localhost, package registries and everything that
isn't a known paid vendor pass straight through untouched.

```bash
npx policypay guard --dry        -- node agent.js   # log only, block nothing
npx policypay guard --limit 5    -- node agent.js   # hard stop above $5
npx policypay guard --open       -- node agent.js   # allow if gateway is down
```

---

## The result object

```js
const r = await pp.check({ amount: 45, vendor: "openai", why: "fine-tune run" });

r.allowed        // false
r.needsApproval  // true  — a human has to approve it
r.decision       // "REQUIRE_APPROVAL"
r.risk           // 60
r.reasons        // ["RISK_THRESHOLD_APPROVAL", "AMOUNT_ANOMALY"]
r.message        // "$45.00 to api.openai.com is waiting for a human (…)"
r.transactionId  // "cmsac1cb60018sbccwt8btlco"
r.approvalId     // "cms4r0hmn004q11ul21eck9r9"
r.checks         // every policy check, pass/fail with detail
r.riskBreakdown  // which factors contributed how many points
```

Three outcomes:

| `decision` | `allowed` | What it means |
|---|---|---|
| `ALLOW` | `true` | Under budget, merchant is fine, risk is low. Go ahead. |
| `REQUIRE_APPROVAL` | `false` | Held for a human. Approve it on the dashboard. |
| `DENY` | `false` | Refused. `reasons` says why. |

---

## Other helpers

**`enforce()`** — throws instead of returning a flag.

```js
try {
  await pp.enforce({ amount: 4.99, vendor: "openai" });
} catch (e) {
  if (e.name === "SpendBlockedError") console.log(e.result.reasons);
}
```

**`guard()`** — runs your function only if the spend is approved.

```js
const data = await pp.guard(
  { amount: 4.99, vendor: "openai", why: "summarise" },
  () => fetch(url).then((r) => r.json())
);
```

**`preview()`** — dry run. Asks what *would* happen, records nothing.
Needs a dashboard token rather than an agent key.

```js
const what = await pp.preview({ amount: 500, vendor: "openai", token });
console.log(what.decision);   // "DENY" — without spending anything
```

---

## Vendor names

Anything reasonable works.

```js
vendor: "openai"                      // → api.openai.com
vendor: "OpenAI"                      // → api.openai.com
vendor: "https://api.stripe.com/v1/x" // → api.stripe.com
vendor: "my-vendor.io"                // → my-vendor.io
```

---

## Configuration

```js
new PolicyPay({
  apiKey: "pp_live_...",        // default: process.env.POLICYPAY_API_KEY
  agentId: "...",               // default: process.env.POLICYPAY_AGENT_ID
  baseUrl: "https://...",       // default: process.env.POLICYPAY_URL
  timeout: 10000,               // ms
  onGatewayError: "closed",     // "closed" blocks, "open" allows
  log: false,                   // print one line per decision
});
```

### If PolicyPay is unreachable

Default is **fail-closed**: the spend is blocked. Nothing gets spent without a
policy decision. Use `onGatewayError: "open"` if availability matters more than
control for your use case.

---

## Retries and duplicates

Every check carries an `idempotency_key`, generated for you. Reusing the same
key inside the guard window is rejected as `DUPLICATE_INTENT` — that is
deliberate, it stops the same purchase going through twice.

Pass your own when you want to tie a check to your own record:

```js
await pp.check({ amount: 4.99, vendor: "openai", key: `order-${orderId}` });
```

---

## Errors

Configuration problems throw `PolicyPayError` with a `code`:

| code | meaning |
|---|---|
| `NO_API_KEY` | `POLICYPAY_API_KEY` is not set |
| `BAD_API_KEY` | key doesn't start with `pp_live_` |
| `NO_AGENT_ID` | `POLICYPAY_AGENT_ID` is not set |
| `INVALID_API_KEY` | gateway rejected the key |
| `BAD_AMOUNT` | amount is not a positive number |

A blocked payment is **not** an error — `check()` returns normally with
`allowed: false`. Only `enforce()` and `guard()` throw on a block.

---

MIT
