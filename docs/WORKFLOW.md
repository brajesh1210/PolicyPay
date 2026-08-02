# Workflow

Four journeys, start to finish.

---

## 1. Onboarding a workspace

```
sign up ──► workspace bootstrapped ──► create key ──► agent guarded
```

**Sign up** — email and password, or Google. Both land in the same
place: `authService` creates the `User`, then `workspaceService.bootstrap()`
runs.

**What bootstrap creates**, so the dashboard is never empty:

| | |
|---|---|
| 3 policies | Conservative, Moderate, Aggressive |
| 3 merchants | OpenAI, Anthropic, Trusted API — all `TRUSTED` |
| 1 agent | `my-first-agent`, on Conservative |

**Create a key** — Connect page → pick the agent → **Create key**. The
full key is shown **once**. After that only the 12-character prefix is
stored, alongside a bcrypt hash.

**Wire it up** — two lines in `.env`, one line in the code. Or wrap the
command with `npx policypay guard --` and change nothing.

---

## 2. A payment, end to end

The path every purchase takes.

```
agent decides it needs to pay
        │
        ├─ pp.check({ amount, vendor, why })
        │
        ▼
POST /v1/authorize-payment
  Authorization: Bearer pp_live_…
        │
        ├─ authenticate ─────── key prefix → bcrypt compare
        ├─ load agent ───────── with its policy
        ├─ 13 hard checks ───── first failure wins
        ├─ risk score ───────── 4 factors, capped at 100
        ├─ verdict ──────────── against the policy's thresholds
        │
        ├─ write transaction ── always, whatever the verdict
        ├─ write audit log ──── hash-chained to the previous row
        ├─ emit alert ───────── on a block, or at 90% of budget
        │
        ▼
ALLOW              REQUIRE_APPROVAL         DENY
counters bump      approval row created     nothing moves
x402 payload       agent polls or waits     reason codes returned
agent proceeds     human decides            agent handles it
```

### What the agent gets back

```json
{
  "transaction_id": "cmsac1cb60018sbccwt8btlco",
  "decision": "REQUIRE_APPROVAL",
  "risk_score": 60,
  "reason_codes": ["RISK_THRESHOLD_APPROVAL", "AMOUNT_ANOMALY"],
  "policy_checks": [ { "check": "…", "passed": true, "detail": "…" } ],
  "risk_breakdown": [ { "factor": "amount_anomaly", "points": 60, "detail": "9.00x historical average" } ],
  "approval_id": "cms4r0hmn004q11ul21eck9r9"
}
```

Through the SDK the same thing is flattened:

```js
r.allowed        // false
r.needsApproval  // true
r.risk           // 60
r.message        // "$45.00 to trusted-api.com is waiting for a human (…)"
```

---

## 3. Human approval

The moment the whole product exists for.

```
agent                          dashboard
  │                                │
  ├─ asks for $45                  │
  │                                │
  │◄─ REQUIRE_APPROVAL             │
  │   approval_id                  │
  │                                │
  ├─ waits ────────────────────►   │  banner: "1 payment is waiting"
  │                                │
  │                                ├─ operator opens Approvals
  │                                ├─ sees risk 60, the reason codes,
  │                                │  the purpose text, the agent
  │                                │
  │                                ├─ clicks Approve
  │                                │
  │◄──────── status: APPROVED ─────┤
  │                                │
  └─ carries on                    │
```

Nothing is signed while a payment is held. If nobody answers within
`APPROVAL_EXPIRY_MINUTES` (30 by default) the request expires and the
agent is told.

Rejecting is a first-class outcome, not an error — a well-written agent
falls back, as the example does when it drops to a local database.

### How an agent waits

Agent keys only reach the authorize endpoint, so `examples/coding-agent`
polls `/v1/approvals` with a dashboard session. A production deployment
would expose a narrow agent-facing status route instead.

---

## 4. Operating

Day-to-day, on the dashboard.

| Page | What it is for |
|---|---|
| **Dashboard** | spend today, decisions, block rate, pending approvals |
| **Transactions** | every request; click one for the full check-by-check breakdown |
| **Approvals** | the queue, with risk and reasons |
| **Agents** | create, pause, attach a policy |
| **Connect** | keys, install snippet, a live listener for the first call |
| **Policies** | edit limits and thresholds |
| **Merchants** | the allowlist and reputations |
| **Alerts** | blocks, budget warnings, injection attempts |
| **Audit Logs** | the hash chain |
| **Simulation** | dry-run a policy change before saving it |
| **Settings** | the global kill switch |

### The kill switch

Two levels: per-agent and global. Both are the very first check in the
pipeline, before the database is touched for anything else — freezing
spending must not depend on the rest of the system being healthy.

### Simulation

`POST /v1/simulate` runs the identical pipeline with `dryRun: true`.
Same code path, same score, but nothing is written and no counter moves.

Useful for "would tightening this budget have blocked yesterday's
traffic?" before you change it.

---

## The five demo scenarios

`demo-agent` runs these against a live gateway. Order matters — the
injection test runs before the budget is exhausted, otherwise the budget
failure masks the injection reason code.

| # | Scenario | Expected | Why |
|---|---|---|---|
| 1 | A normal payment | `ALLOW` | trusted merchant, small amount |
| 2 | An unapproved merchant | `DENY` | not on the allowlist |
| 3 | A prompt injection attempt | `DENY` | risk 80 from the purpose text alone |
| 4 | A large payment needs a human | `REQUIRE_APPROVAL` | 9× the agent's own average |
| 5 | The daily budget runs out | `DENY` | four payments succeed, the fifth does not |

Scenario 3 is the one worth watching. Trusted merchant, $2.50, budget
fine — every hard check passes. It is denied purely on intent.

Scenario 5 needs fresh counters:

```bash
npm run reset:counters --workspace backend
```
