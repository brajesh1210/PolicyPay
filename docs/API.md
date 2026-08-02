# API reference

Base URL: `https://policypay-production.up.railway.app`

---

## Authentication

Two schemes, two audiences.

### Agent key

```http
Authorization: Bearer pp_live_a3cb2bb110e7436a43cdd78fc0246cbc
```

Reaches **one route only**: `POST /v1/authorize-payment`. It cannot read
transactions, change policies or touch budgets. Keys are stored as
bcrypt hashes; only the 12-character prefix is kept in the clear.

### Dashboard token

```http
Authorization: Bearer <jwt>
```

From `POST /v1/auth/login`, valid 24 hours. Reaches every read and admin
route, scoped to that user's workspace.

---

## Conventions

**Naming differs by audience.** The agent-facing routes use
`snake_case`; everything the dashboard reads returns `camelCase`. The
SDK hides this.

**Every response is enveloped:**

```json
{ "success": true, "data": { … } }
{ "success": true, "data": [ … ], "meta": { "total": 58, "page": 1, "limit": 20 } }
{ "success": false, "error": { "code": "MERCHANT_NOT_ALLOWED", "message": "…" } }
```

---

## The one that matters

### `POST /v1/authorize-payment`

Ask permission before spending. Agent key required.

```http
POST /v1/authorize-payment
Authorization: Bearer pp_live_…
Content-Type: application/json

{
  "agent_id": "cms36q3ez0005su8ruhidbwl7",
  "merchant": {
    "domain": "api.openai.com",
    "name": "OpenAI"
  },
  "amount_usd": 4.99,
  "currency": "USDC",
  "purpose": "GPT-4 calls for the summarisation step",
  "idempotency_key": "a7f3c9e1-…"
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `agent_id` | string | yes | must belong to the key |
| `merchant.domain` | string | yes | |
| `merchant.name` | string | no | shown on the dashboard |
| `amount_usd` | number | yes | positive |
| `currency` | string | yes | `USDC` |
| `purpose` | string | no | max 500 — this is what the injection guard reads |
| `idempotency_key` | string | yes | unique per payment |

**200 — allowed**

```json
{
  "success": true,
  "data": {
    "transaction_id": "cmsac1cb60018sbccwt8btlco",
    "decision": "ALLOW",
    "risk_score": 0,
    "reason_codes": ["ALL_CHECKS_PASSED"],
    "policy_checks": [
      { "check": "global_kill_switch", "passed": true, "detail": "Global kill switch inactive" }
    ],
    "risk_breakdown": [],
    "x402_payment": { "signed_payload": "0x…", "network": "base-sepolia" }
  }
}
```

**200 — held for a human**

```json
{
  "decision": "REQUIRE_APPROVAL",
  "risk_score": 60,
  "reason_codes": ["RISK_THRESHOLD_APPROVAL", "AMOUNT_ANOMALY"],
  "risk_breakdown": [
    { "factor": "amount_anomaly", "points": 60, "detail": "9.00x historical average" }
  ],
  "approval_id": "cms4r0hmn004q11ul21eck9r9"
}
```

**200 — denied**

```json
{
  "decision": "DENY",
  "risk_score": 80,
  "reason_codes": ["RISK_THRESHOLD_DENY", "PROMPT_INJECTION_SUSPECTED"],
  "risk_breakdown": [
    { "factor": "prompt_injection", "points": 80, "detail": "Suspected prompt injection phrase detected" }
  ]
}
```

A refusal is still `HTTP 200` with `success: true` — the gateway
answered correctly. Non-2xx means the request itself was wrong.

---

## Reason codes

| Code | Meaning |
|---|---|
| `ALL_CHECKS_PASSED` | nothing flagged |
| `GLOBAL_KILL_SWITCH` | workspace frozen |
| `AGENT_KILL_SWITCH` | agent frozen |
| `AGENT_INACTIVE` | agent paused or revoked |
| `POLICY_DISABLED` | policy switched off |
| `DUPLICATE_INTENT` | same intent replayed inside the guard window |
| `MERCHANT_BLOCKED` | merchant reputation is `BLOCKED` |
| `MERCHANT_NOT_ALLOWED` | unknown merchant, policy forbids it |
| `UNKNOWN_MERCHANT_RISK` | unknown merchant added risk |
| `CATEGORY_NOT_ALLOWED` | category not permitted |
| `PER_TX_LIMIT_EXCEEDED` | over the single-payment cap |
| `DAILY_BUDGET_EXCEEDED` | daily budget used up |
| `MONTHLY_BUDGET_EXCEEDED` | monthly budget used up |
| `HOURLY_RATE_EXCEEDED` | too many this hour |
| `DAILY_RATE_EXCEEDED` | too many today |
| `AMOUNT_ANOMALY` | unusually large for this agent |
| `FREQUENCY_BURST` | several payments in a short window |
| `PROMPT_INJECTION_SUSPECTED` | purpose text looks like an injection |
| `RISK_THRESHOLD_APPROVAL` | score crossed the approval threshold |
| `RISK_THRESHOLD_DENY` | score crossed the deny threshold |

---

## Auth

| Method | Path | Body | Returns |
|---|---|---|---|
| `POST` | `/v1/auth/register` | `{ name, email, password }` | user; bootstraps a workspace |
| `POST` | `/v1/auth/login` | `{ email, password }` | `{ user, apiToken }` |
| `POST` | `/v1/auth/oauth` | `{ email, name? }` | `{ user, apiToken }` — Google; creates on first sign-in |

> The token field is **`apiToken`**, not `token`.

---

## Agents

| Method | Path | Notes |
|---|---|---|
| `GET` | `/v1/agents` | `?status=` `?search=` |
| `POST` | `/v1/agents` | `{ name, description?, policyId, status? }` |
| `GET` | `/v1/agents/:id` | |
| `PUT` | `/v1/agents/:id` | |
| `DELETE` | `/v1/agents/:id` | fails if transactions exist |
| `PATCH` | `/v1/agents/:id/kill-switch` | `{ active: boolean }` |
| `POST` | `/v1/agents/:id/api-keys` | `{ name }` → **the only time the key is returned** |
| `GET` | `/v1/agents/:id/api-keys` | prefixes only |
| `DELETE` | `/v1/agents/:id/api-keys/:keyId` | revoke |

Creating a key:

```json
{
  "id": "cmsag7sai007rsbccl1k32nfo",
  "name": "laptop",
  "keyPrefix": "pp_live_c505",
  "apiKey": "pp_live_c50552d0c874aed789a3877fc2a639e2",
  "createdAt": "2026-08-01T14:10:14.394Z"
}
```

`apiKey` never appears again.

---

## Policies

| Method | Path | Notes |
|---|---|---|
| `GET` | `/v1/policies` | |
| `GET` | `/v1/policies/templates` | the three tiers |
| `POST` | `/v1/policies` | custom |
| `POST` | `/v1/policies/from-template` | `{ templateName, customName? }` |
| `GET` | `/v1/policies/:id` | |
| `PUT` | `/v1/policies/:id` | |
| `PATCH` | `/v1/policies/:id/toggle` | enable / disable |
| `DELETE` | `/v1/policies/:id` | |

## Merchants

| Method | Path | Notes |
|---|---|---|
| `GET` | `/v1/merchants` | `?reputation=` `?search=` |
| `POST` | `/v1/merchants` | `{ name, domain, category, reputation? }` |
| `PATCH` | `/v1/merchants/:id/reputation` | `TRUSTED` · `UNKNOWN` · `BLOCKED` |
| `DELETE` | `/v1/merchants/:id` | |

## Transactions

| Method | Path | Notes |
|---|---|---|
| `GET` | `/v1/transactions` | `?page=` `?limit=` `?decision=` `?agentId=` `?merchant=` `?dateFrom=` `?dateTo=` |
| `GET` | `/v1/transactions/:id` | includes every policy check |

## Approvals

| Method | Path | Notes |
|---|---|---|
| `GET` | `/v1/approvals` | `?status=PENDING` |
| `POST` | `/v1/approvals/:id/approve` | `{ note? }` |
| `POST` | `/v1/approvals/:id/reject` | `{ note? }` |

Response nests the row: `data.approval.status`.

## Alerts

| Method | Path |
|---|---|
| `GET` | `/v1/alerts` — `?severity=` `?is_dismissed=` |
| `PATCH` | `/v1/alerts/:id/read` |
| `PATCH` | `/v1/alerts/:id/dismiss` |

## Audit logs

| Method | Path | Notes |
|---|---|---|
| `GET` | `/v1/audit-logs` | `?page=` `?limit=` — paginated, newest first |

## Analytics

| Method | Path |
|---|---|
| `GET` | `/v1/analytics/overview` |
| `GET` | `/v1/analytics/spending-trends?days=7` |
| `GET` | `/v1/analytics/status-distribution` |
| `GET` | `/v1/analytics/recent-transactions?limit=5` |

```json
{
  "total_spend_today": 28.66,
  "total_spend_today_change_pct": 201.68,
  "blocked_today": 3,
  "pending_approvals": 1,
  "active_agents": 2
}
```

## Kill switch

| Method | Path | Notes |
|---|---|---|
| `GET` | `/v1/kill-switch` | `{ active }` |
| `PATCH` | `/v1/kill-switch` | `{ active: boolean }` — global freeze |

## Simulation

| Method | Path | Notes |
|---|---|---|
| `POST` | `/v1/simulate` | dry run — same pipeline, writes nothing |
| `POST` | `/v1/simulate/replay` | re-run a past transaction against a draft policy |

Takes the same snake_case body as authorize, plus an optional
`policyDraft`. Returns the same shape with `"simulated": true`.

## Health

| Method | Path | Auth |
|---|---|---|
| `GET` | `/health` | none — `{ ok: true, uptime }` |

---

## Errors

| HTTP | Code | Cause |
|---|---|---|
| 400 | `VALIDATION_ERROR` | body failed the schema; `details` has the field map |
| 401 | `UNAUTHORIZED` | missing or bad dashboard token |
| 401 | `INVALID_API_KEY` | missing, malformed or revoked agent key |
| 403 | `FORBIDDEN` | `agent_id` does not belong to the key |
| 404 | `NOT_FOUND` | |
| 409 | `CONFLICT` | duplicate, e.g. a merchant domain already in this workspace |
| 500 | `INTERNAL_ERROR` | |

---

## Using the SDK instead

```js
import { PolicyPay } from "policypay";

const pp = new PolicyPay();          // reads POLICYPAY_API_KEY / _AGENT_ID

const r = await pp.check({ amount: 4.99, vendor: "openai", why: "GPT-4 calls" });

r.allowed        // boolean
r.needsApproval  // boolean
r.decision       // "ALLOW" | "DENY" | "REQUIRE_APPROVAL"
r.risk           // 0–100
r.reasons        // string[]
r.message        // one printable sentence
r.transactionId
r.approvalId
r.checks         // every policy check
r.riskBreakdown  // which factors scored
```

Also on the client:

```js
await pp.enforce({ … });                  // throws SpendBlockedError unless allowed
await pp.guard({ … }, () => doThing());   // runs the callback only if allowed
await pp.ping();                          // is the gateway up
```

The SDK generates the idempotency key, turns `"openai"` into
`api.openai.com`, and fails **closed** if the gateway is unreachable —
override with `onGatewayError: "open"`.
