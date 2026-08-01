# PolicyPay — example agent

Two small agents, both spending real-ish money against the live PolicyPay
gateway. Nothing here is mocked: every verdict comes back from the policy
engine and lands on the dashboard.

```bash
npm install
cp .env.example .env      # paste your key and agent id
npx policypay test        # check the setup
```

---

## 1. The agent that asks — `agent.mjs`

A coding agent building a weather app. It needs three things, and it asks
PolicyPay before each one.

```bash
npm start
```

```
  weather-app agent   task: build a weather dashboard

● I need a weather data feed — $2.00 from trusted-api.com
  ✓ approved  risk 20/100
  purchased. continuing.

● I need a cheap database from a vendor I found — $3.00 from shady-payments.com
  ✗ blocked  risk 65/100
    · MERCHANT_NOT_ALLOWED
    · unknown_merchant_allowed: Unknown merchants are blocked by policy
  skipping this one.

● I need a year of hosting, paid upfront — $90.00 from trusted-api.com
  ⏸ needs a human  risk 60/100 · RISK_THRESHOLD_APPROVAL, AMOUNT_ANOMALY
  approval id cmsadoqtm005jsbcca8surqfb
  waiting for someone to approve this on the dashboard.
```

Three purchases, three different outcomes. The integration is one line:

```js
const r = await pp.check({ amount, vendor, why });
if (!r.allowed) return;
```

Approve the held payment on the dashboard and the agent can carry on.

---

## 2. The agent that doesn't know — `naive-agent.mjs`

Same idea, except this file contains **no PolicyPay code at all**. No import,
no key, no check. It just calls vendors directly.

Run it bare and it spends freely:

```bash
node naive-agent.mjs
```

Run it behind the guard and every paid call is authorised first — with the
file completely unchanged:

```bash
npm run guarded
```

```
  ● PolicyPay guard active  fail-closed

● I need model tokens
  policypay ALLOW     $0.05 OpenAI
  vendor replied 200. continuing.

● I need a database from a vendor I found
  policypay BLOCK     $1.00 Shady Payments  MERCHANT_NOT_ALLOWED
  could not: PolicyPay blocked this payment to Shady Payments

● I need to read my own config
  could not: fetch failed          ← localhost, never intercepted

  policypay 2 payment requests checked (OpenAI×1, Shady Payments×1)
```

This is how you put a policy in front of an agent you didn't write.

---

## Why the third purchase uses a second agent

`agent.mjs` runs day-to-day work on a **conservative** agent — $5 per
transaction, $20 a day. The annual hosting bill is deliberately routed
through a **procurement** agent with a higher cap, which is what makes it
escalate to a human instead of being refused outright.

Policies are per-agent, not global. That is the point.

Set `POLICYPAY_PROCUREMENT_KEY` and `POLICYPAY_PROCUREMENT_AGENT_ID` in your
`.env` to see it. Leave them out and everything runs on the one agent.

---

## Files

| File | What it shows |
|---|---|
| `agent.mjs` | Explicit `pp.check()` before each purchase |
| `naive-agent.mjs` | An unmodified agent wrapped by `policypay guard` |
| `.env.example` | The two values you need |
