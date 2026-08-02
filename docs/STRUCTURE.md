# Project structure

An npm workspace monorepo. Six packages, one lockfile.

```
policypay/
├── backend/           the policy engine  ·  Express + TypeScript
├── frontend/          the dashboard      ·  Next.js 14
├── packages/
│   ├── sdk/           the npm package + CLI
│   └── contracts/     zod schemas shared by both sides
├── examples/
│   └── agent/         a guarded agent, and an unguarded one
├── demo-agent/        five scenarios against a live gateway
├── docs/              you are here
├── docker-compose.yml Postgres + Redis for local work
└── package.json       workspace root
```

Always `npm install` from the **root**. Installing inside a package
breaks the symlinks between them.

---

## `backend/`

```
backend/
├── prisma/
│   ├── schema.prisma          10 models
│   ├── seed.ts                demo workspace + 6 days of history
│   └── migrations/
│       ├── 20260726180538_init/
│       └── 20260801160000_multi_tenant/
├── scripts/
│   └── reset-counters.ts      flush Redis budgets before a demo
└── src/
    ├── index.ts               express app, route mounting, CORS
    ├── config/                database · redis · env (zod-validated)
    ├── middleware/
    │   ├── apiKeyAuth.ts      agent keys  → the authorize route only
    │   ├── adminAuth.ts       dashboard JWT → everything else
    │   └── errorHandler.ts    turns thrown errors into the envelope
    ├── routes/                12 routers, one per resource
    ├── controllers/           validate → call a service → respond
    ├── services/              the actual logic
    ├── utils/
    │   ├── tenant.ts          tenantId(req) — used by every scoped query
    │   ├── errors.ts          the typed error classes
    │   └── response.ts        ok() / fail()
    └── types/express.d.ts     req.user and req.agentAuth
```

### The services, by job

**The decision path** — everything a payment touches:

| File | Responsibility |
|---|---|
| `pipeline.service.ts` | orchestrates the three stages |
| `policyEngine.service.ts` | the 13 hard checks |
| `riskEngine.service.ts` | the 4 risk factors |
| `decisionEngine.service.ts` | score + thresholds → verdict |
| `budgetEngine.service.ts` | daily and monthly spend — Redis |
| `frequencyEngine.service.ts` | rate windows and bursts — Redis |
| `duplicateGuard.service.ts` | replay protection — Redis |
| `promptIntentGuard.service.ts` | injection phrases — pure function |
| `walletSigner.service.ts` | x402 payload on an allow |

Five of these never touch Postgres, which is what keeps the request
under 150 ms.

**Everything else:**

| File | Responsibility |
|---|---|
| `auth.service.ts` | register, login, Google sign-in |
| `workspace.service.ts` | bootstrap a new tenant |
| `agents.service.ts` | agents and their API keys |
| `policies.service.ts` | policies, and the three templates |
| `merchants.service.ts` | the allowlist |
| `transactions.service.ts` | paginated reads |
| `approvals.service.ts` | the human queue, and expiry |
| `alerts.service.ts` | blocks and budget warnings |
| `auditLog.service.ts` | the hash chain |
| `analytics.service.ts` | the four dashboard endpoints |
| `globalConfig.service.ts` | the global kill switch |
| `simulation.service.ts` | dry runs |

### Where to change what

| Task | File |
|---|---|
| Add a hard check | `policyEngine.service.ts` |
| Change risk weights | `riskEngine.service.ts` |
| Move a threshold | `policies.service.ts` → `POLICY_TEMPLATES` |
| Add an injection phrase | `promptIntentGuard.service.ts` |
| Change what a new tenant gets | `workspace.service.ts` |
| Add an endpoint | a `routes/` file + `controllers/` + `services/` |

---

## `frontend/`

```
frontend/
├── app/
│   ├── landing/           the marketing page
│   ├── login/             email + Google
│   ├── dashboard/         KPIs, trends, live feed
│   ├── transactions/      list + decision detail
│   ├── approvals/         the human queue
│   ├── agents/            create, pause, attach a policy
│   ├── connect/           keys, snippet, live listener
│   ├── policies/          limits and thresholds
│   ├── merchants/         the allowlist
│   ├── alerts/            
│   ├── audit-logs/        the hash chain
│   ├── simulation/        dry-run a policy
│   ├── settings/          kill switch, account
│   └── api/auth/          NextAuth handler
├── components/
│   ├── AppShell.tsx       sidebar, topbar, nav
│   ├── ui.tsx             Button, Card, Field, Tag, Terminal…
│   └── Icon.tsx           41 inline SVGs
├── lib/
│   ├── api.ts             axios client, envelope unwrap, token refresh
│   ├── auth.ts            NextAuth config — credentials + Google
│   ├── hooks.ts           useApi
│   ├── types.ts           mirrors the backend
│   ├── currency.tsx       USD / INR
│   └── format.ts          money, dates, risk colours
├── middleware.ts          route protection
└── next.config.js         the /api/gateway/* rewrite
```

**`lib/api.ts` is worth reading first.** It decides whether the browser
talks to the proxy or the server talks to the backend directly, unwraps
the `{ success, data }` envelope, and retries once with a fresh token on
a 401.

---

## `packages/sdk/`

The published surface.

```
packages/sdk/
├── src/
│   ├── index.ts        the PolicyPay class
│   └── preload.cts     injected by `guard` to patch fetch + http
├── bin/cli.js          policypay test | guard
└── package.json        builds to CJS + ESM + .d.ts
```

Zero runtime dependencies. 12 kB packed.

`preload.cts` is the interesting one. `npx policypay guard -- node app.js`
spawns the target with `NODE_OPTIONS=--require …/preload.cjs`, which
patches `globalThis.fetch` and `http(s).request`. Calls to a known paid
vendor are authorised first; localhost, package registries and
everything else pass straight through.

That is how an agent gets guarded without changing a line of its code.

---

## `packages/contracts/`

One file. The zod schemas the backend validates with and the SDK types
against — so a field cannot drift on one side without breaking the
build on the other.

---

## `examples/agent/`

| File | Shows |
|---|---|
| `agent.mjs` | explicit `pp.check()` before each purchase |
| `naive-agent.mjs` | **no PolicyPay code at all** — guarded by the CLI wrapper |

Running the second one bare and then behind `npx policypay guard` is the
clearest demonstration of what the wrapper does.

---

## `demo-agent/`

The five scenarios, against a real gateway.

```
demo-agent/src/
├── run-all.ts       runs them in order, prints the summary
├── agent.ts         the HTTP client
├── scenarios/       one file each
└── merchants/       mock vendors that reply HTTP 402
```

`npm run merchants` must be running in another terminal — the scenarios
start from a real 402 challenge, not a fabricated one.

Order matters: the injection test runs before the budget is exhausted,
or the budget failure masks the injection reason code.

---

## Naming

| Convention | Where |
|---|---|
| `camelCase` | TypeScript, and every dashboard-facing response |
| `snake_case` | the agent-facing wire format |
| `*.service.ts` | logic |
| `*.controller.ts` | validate and respond, no logic |
| `*.routes.ts` | paths and middleware only |

---

## Build order

`contracts` → `backend` → everything else. The root script enforces it:

```json
"build": "npm run build --workspace @policypay/contracts && npm run build --workspace backend"
```

Building the backend first fails with
`Cannot find module '@policypay/contracts'`.
