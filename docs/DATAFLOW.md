# Data flow

What moves where, and what gets written down.

---

## The authorize request

One agent call, traced all the way through.

```
┌──────────┐
│  agent   │  pp.check({ amount: 45, vendor: "trusted-api.com" })
└────┬─────┘
     │  POST /v1/authorize-payment
     │  Authorization: Bearer pp_live_a3cb…
     │  { agent_id, merchant:{domain,name}, amount_usd,
     │    currency, purpose, idempotency_key }
     ▼
┌─────────────────────────────────────────────────────┐
│  apiKeyAuth                                         │
│    prefix = key[0:12]                               │
│    SELECT * FROM ApiKey WHERE keyPrefix = … ────────┼──► Postgres
│    bcrypt.compare(key, row.keyHash)                 │
│    UPDATE ApiKey SET lastUsedAt = now() ────────────┼──► Postgres
└────┬────────────────────────────────────────────────┘
     ▼
┌─────────────────────────────────────────────────────┐
│  authorizeController                                │
│    zod validate the body                            │
│    body.agent_id must equal the authenticated agent │
│    SELECT Agent + Policy ───────────────────────────┼──► Postgres
└────┬────────────────────────────────────────────────┘
     ▼
┌─────────────────────────────────────────────────────┐
│  policyEngine — 13 checks, first failure wins       │
│                                                     │
│   1 global_kill_switch      GlobalConfig ───────────┼──► Postgres
│   2 agent_kill_switch       (already loaded)        │
│   3 agent_status            (already loaded)        │
│   4 policy_enabled          (already loaded)        │
│   5 duplicate_guard         SET NX intent:{sha} ────┼──► Redis
│   6 merchant_reputation     SELECT Merchant ────────┼──► Postgres
│   7 unknown_merchant_allowed                        │
│   8 category_rules                                  │
│   9 per_transaction_limit                           │
│  10 daily_budget            GET spend:daily:… ──────┼──► Redis
│  11 monthly_budget          GET spend:monthly:… ────┼──► Redis
│  12 hourly_frequency        GET freq:hour:… ────────┼──► Redis
│  13 daily_frequency         GET freq:day:… ─────────┼──► Redis
└────┬────────────────────────────────────────────────┘
     ▼
┌─────────────────────────────────────────────────────┐
│  riskEngine — 4 factors, capped at 100              │
│                                                     │
│   merchant UNKNOWN                        +25       │
│   amount vs own average    ≥5x/≥3x/≥1.5x  +60/40/20 │
│     SELECT last 20 ALLOW transactions ──────────────┼──► Postgres
│   burst  >3 in 10 min      LRANGE burst:… ──────────┼──► Redis
│   prompt injection phrase                 +80       │
└────┬────────────────────────────────────────────────┘
     ▼
┌─────────────────────────────────────────────────────┐
│  decisionEngine                                     │
│    score ≥ policy.denyThresholdScore     → DENY     │
│    score ≥ policy.approvalThresholdScore → APPROVAL │
│    otherwise                             → ALLOW    │
└────┬────────────────────────────────────────────────┘
     ▼
┌─────────────────────────────────────────────────────┐
│  side effects — always                              │
│                                                     │
│   INSERT Transaction ───────────────────────────────┼──► Postgres
│   INSERT AuditLog (payloadHash, prevHash) ──────────┼──► Postgres
│   INSERT Alert  on block / at 90% budget ───────────┼──► Postgres
│                                                     │
│  ALLOW only:                                        │
│   INCRBYFLOAT spend:daily / spend:monthly ──────────┼──► Redis
│   INCR freq:hour / freq:day, RPUSH burst ───────────┼──► Redis
│   UPDATE Agent totalSpent, totalTx ─────────────────┼──► Postgres
│   walletSigner → x402 payload                       │
│                                                     │
│  REQUIRE_APPROVAL only:                             │
│   INSERT Approval (expires in 30 min) ──────────────┼──► Postgres
└────┬────────────────────────────────────────────────┘
     ▼
   response
```

**Counters only move on `ALLOW`.** A held payment has not been spent
yet, so it must not consume budget — if it did, a queue of pending
approvals could starve an agent that never actually spent anything.

---

## Where data lives

### PostgreSQL — the source of truth

```
User
 ├── Agent      (userId)  ──┬── ApiKey
 │                          ├── Transaction ──── AuditLog
 │                          ├── Approval
 │                          └── Alert
 ├── Policy     (userId)  ──── Agent
 └── Merchant   (userId)

GlobalConfig    (singleton — the global kill switch)
```

`userId` sits on three tables. Everything else is reached through the
agent that owns it:

```ts
where: { agent: { userId } }                       // transactions, approvals, alerts
where: { transaction: { agent: { userId } } }      // audit logs
```

### Redis — hot counters only

| Key | Type | TTL | Read by |
|---|---|---|---|
| `spend:daily:{agentId}:{yyyy-mm-dd}` | float | 48h | daily budget |
| `spend:monthly:{agentId}:{yyyy-mm}` | float | 40d | monthly budget |
| `freq:hour:{agentId}:{yyyy-mm-dd-hh}` | int | 2h | hourly rate |
| `freq:day:{agentId}:{yyyy-mm-dd}` | int | 48h | daily rate |
| `burst:{agentId}` | list | 10 min | burst factor |
| `intent:{sha256}` | flag | 10 min | duplicate guard |

Nothing here is authoritative. Flush Redis and the policy engine keeps
working — budgets simply restart from zero, which is why
`reset:counters` is a safe operation before a demo.

The duplicate hash is `sha256(agentId | merchantDomain | amountUsd | idempotencyKey)`.

---

## The dashboard's data

Different path, different auth.

```
browser ──► /api/gateway/v1/*  (same origin)
              │  Next.js rewrite
              ▼
            Railway API
              │  adminAuth: JWT → userId
              ▼
            Postgres, scoped to that user
```

The browser never contacts the Railway domain directly. That is
deliberate — see [ARCHITECTURE.md](ARCHITECTURE.md#why-the-dashboard-proxies-the-api).

### Analytics

| Endpoint | Reads |
|---|---|
| `/v1/analytics/overview` | spend today, blocked today, pending, active agents |
| `/v1/analytics/spending-trends?days=7` | daily totals, for the chart |
| `/v1/analytics/status-distribution` | allow / deny / approval split |
| `/v1/analytics/recent-transactions?limit=5` | the live feed |

All four filter through `agent: { userId }`.

---

## The audit chain

```
row n-2   payloadHash 3bb1d938…
row n-1   payloadHash e2f9dc34…   prevHash 3bb1d938…
row n     payloadHash 47b4a091…   prevHash e2f9dc34…
                                            ▲
                        each row points back at the last
```

`payloadHash = sha256(transaction payload)`. Edit any historical row and
every hash after it stops matching. The Audit Logs page shows the chain
and flags a break.

---

## Two shapes on the wire

The one thing to keep straight:

| | Convention | Example |
|---|---|---|
| Agent-facing | `snake_case` | `amount_usd`, `risk_score`, `reason_codes` |
| Dashboard-facing | `camelCase` | `amountUsd`, `riskScore`, `reasonCodes` |

`POST /v1/authorize-payment` and `POST /v1/simulate` take snake_case and
a `merchant` **object**. Every read route returns camelCase.

The SDK hides this. Calling the API directly, it matters.

---

## Response envelope

Every response, success or failure:

```json
{ "success": true, "data": { … }, "meta": { "total": 58, "page": 1, "limit": 20 } }
```

```json
{ "success": false, "error": { "code": "MERCHANT_NOT_ALLOWED", "message": "…" } }
```

`meta` appears on paginated lists only.
