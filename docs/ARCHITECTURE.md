# Architecture

How PolicyPay is put together, and why each piece is where it is.

---

## The shape of it

```
┌─────────────────┐         ┌─────────────────┐
│   AI agents     │         │  Human operator │
│                 │         │                 │
│  research-bot   │         │   Next.js       │
│  highvalue-bot  │         │   dashboard     │
└────────┬────────┘         └────────┬────────┘
         │                            │
    API key                    NextAuth JWT
  (pp_live_…)                  (24h expiry)
         │                            │
         ▼                            ▼
┌──────────────────────────────────────────────┐
│         PolicyPay gateway  ·  Express        │
│                                              │
│   POST /v1/authorize-payment   ← agents      │
│   GET  /v1/transactions        ← dashboard   │
│   GET  /v1/analytics/*         ← dashboard   │
│   POST /v1/approvals/:id/…     ← dashboard   │
│                                              │
│   ┌────────────────────────────────────┐     │
│   │  pipeline.service                  │     │
│   │    ├─ policyEngine   13 checks     │     │
│   │    ├─ riskEngine     4 factors     │     │
│   │    ├─ decisionEngine verdict       │     │
│   │    └─ walletSigner   x402 payload  │     │
│   └────────────────────────────────────┘     │
└───────┬──────────────────────────┬───────────┘
        │                          │
        ▼                          ▼
┌───────────────┐          ┌───────────────┐
│  PostgreSQL   │          │     Redis     │
│               │          │               │
│  10 models    │          │  spend:daily  │
│  hash-chained │          │  freq:hour    │
│  audit log    │          │  intent:      │
└───────────────┘          └───────────────┘
```

---

## Two callers, two auth schemes

This is the first thing to understand, because it decides everything
else.

| Caller | Header | Reaches |
|---|---|---|
| Agent | `Authorization: Bearer pp_live_…` | only `POST /v1/authorize-payment` |
| Dashboard | `Authorization: Bearer <JWT>` | every read and admin route |

An agent key is deliberately narrow. It can ask for permission to spend
and nothing else — it cannot list transactions, read policies, or change
a budget. If a key leaks, the blast radius is one agent's spending, and
that spending is already capped by its policy.

The middleware lives in `backend/src/middleware/`:

- `apiKeyAuth.ts` — bcrypt-compares the key against stored hashes,
  looked up by a 12-character prefix so we are not comparing against
  every row
- `adminAuth.ts` — verifies the JWT and puts `userId` on the request

---

## The request path

`POST /v1/authorize-payment` is the only route that matters to an agent.
Eight database queries, in this order:

```
1  apiKey.findMany     find candidate keys by prefix
2  apiKey.update       stamp lastUsedAt
3  agent.findUnique    load the agent and its policy
4  merchant.findUnique look up the vendor, scoped to the agent's owner
5  transaction.findMany last 20 ALLOWs — the risk baseline
   ── decide ──
6  transaction.create  write the row, whatever the verdict
7  agent.update        bump totals (ALLOW only)
8  approval.create     if a human is needed
```

Redis is consulted between 5 and 6 for budgets, rate windows and the
duplicate guard. Those are `INCR` and `SET NX` calls — no round trip to
Postgres.

Measured p95 on the deployed instance: **under 150 ms**.

---

## Why Redis and not just Postgres

Two agents can hit the gateway in the same millisecond. If budgets lived
in a Postgres column we would need `SELECT … FOR UPDATE` and a
transaction around every payment, and the row would become the
bottleneck.

Redis counters are atomic by construction:

```
spend:daily:{agentId}:{yyyy-mm-dd}     INCRBYFLOAT, TTL 48h
spend:monthly:{agentId}:{yyyy-mm}      INCRBYFLOAT, TTL 40d
freq:hour:{agentId}:{yyyy-mm-dd-hh}    INCR,        TTL 2h
freq:day:{agentId}:{yyyy-mm-dd}        INCR,        TTL 48h
burst:{agentId}                        list of timestamps, 10 min window
intent:{sha256}                        SET NX — the duplicate guard
```

Every key is namespaced by `agentId`, which is a globally unique cuid.
That means the counters were **already tenant-safe** when multi-tenancy
was added — not one line of Redis code had to change.

Postgres stays the source of truth. Redis is the fast path.

---

## The pipeline

`pipeline.service.ts` is the orchestrator. It is deliberately thin —
175 lines — and calls out to specialists:

| Service | Job | Touches DB |
|---|---|---|
| `policyEngine` | the 13 hard checks | 1 query (merchant) |
| `riskEngine` | the 4 risk factors | 1 query (recent tx) |
| `budgetEngine` | daily and monthly spend | Redis only |
| `frequencyEngine` | rate windows and bursts | Redis only |
| `duplicateGuard` | replay protection | Redis only |
| `promptIntentGuard` | injection phrases | neither |
| `decisionEngine` | score → verdict | neither |
| `walletSigner` | x402 payload for an ALLOW | neither |

Four of these never touch the database at all, which is why the whole
request stays inside 150 ms.

### Short-circuiting

A hard check that fails ends the request immediately. The risk engine
does not run. This matters for the kill switch: freezing a workspace
must not depend on any downstream service being healthy.

---

## Multi-tenancy

`userId` sits on exactly three tables:

```
User ──owns──► Agent    ──► Transaction, Approval, ApiKey, Alert
     ──owns──► Policy
     ──owns──► Merchant
```

Transactions, approvals, alerts and audit logs are **not** given their
own `userId`. They are filtered through the agent that owns them:

```ts
where: { agent: { userId } }
```

Three columns instead of eight, and the largest table in the schema
(`Transaction`) needed no migration at all.

### Uniqueness had to move

Before: `Agent.name` and `Merchant.domain` were globally unique. Two
companies could not both add `api.openai.com`.

After:

```prisma
@@unique([userId, name])      // Agent
@@unique([userId, domain])    // Merchant
```

Per tenant, not per install. This single constraint was the reason the
old schema could not be multi-tenant.

---

## The audit chain

Every decision writes an `AuditLog` row:

```
payloadHash = sha256(transaction payload)
prevHash    = the payloadHash of the previous row
```

Each row points back at the one before it. Change any historical row and
every hash after it stops matching, which is visible on the Audit Logs
page.

It is not a blockchain and does not claim to be. It is a cheap way to
make silent edits detectable.

---

## Why the dashboard proxies the API

`frontend/next.config.js` rewrites `/api/gateway/*` to the backend, and
`lib/api.ts` points the browser at that path instead of the Railway
domain directly.

The reason is practical: some networks, DNS resolvers and browser
extensions block unfamiliar domains outright, which showed up as
`ERR_NAME_NOT_RESOLVED` and an empty dashboard on an otherwise healthy
deployment.

Same-origin requests avoid that entirely, and remove the CORS
configuration as a side effect. Server-side code still calls the backend
directly — there is no proxy to go through.

---

## Deployment

| Piece | Where | Notes |
|---|---|---|
| API | Railway | build from repo root; root directory must stay empty so the workspace resolves |
| Postgres | Railway | migrations run pre-deploy |
| Redis | Railway | same project |
| Dashboard | Vercel | `NEXT_PUBLIC_API_URL` points at the Railway URL |

Railway build:

```
build       npm install && npm run build
start       npm run start
pre-deploy  npx prisma migrate deploy --schema backend/prisma/schema.prisma
```

The server binds `0.0.0.0`, not `localhost`, or the platform health check
never passes.

---

## Things deliberately left out

**A wallet.** PolicyPay does not hold funds. It authorises or refuses;
settlement stays on the agent's own rail. Holding money would mean
custody, licensing and PCI questions that have nothing to do with policy
enforcement.

**On-chain x402 settlement.** The signer produces a payload and the demo
uses a mock network. Real settlement is an integration, not a rewrite.

**A queue.** Every decision is synchronous. An agent that must wait 150 ms
for permission is not a problem worth solving with infrastructure.
