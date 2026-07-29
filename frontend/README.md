# PolicyPay — Frontend

Next.js 14 (App Router) + TypeScript + NextAuth v4.
Talks to the live backend at `https://policypay-production.up.railway.app`.

## Setup

1. Create `frontend/.env.local` (it is gitignored — every teammate makes their own):

```
NEXT_PUBLIC_API_URL=https://policypay-production.up.railway.app
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=policypay-nextauth-dev-secret
API_JWT_SECRET=policypay-dev-secret-change-me
```

2. Install and run:

```
npm install
npm run dev
```

3. Open http://localhost:3000 and sign in with
   `admin@policypay.demo` / `Demo1234!`

> **The app must run on port 3000.** The backend's CORS allowlist only contains
> `http://localhost:3000`. `npm run dev` pins the port with `next dev -p 3000`;
> if the port is already taken, free it instead of letting Next pick 3001.
>
> Windows: `netstat -ano | findstr :3000` then `taskkill /PID <pid> /F`

## Routes

| Route | What it does |
|---|---|
| `/login` | Credentials sign-in, split-screen layout |
| `/dashboard` | Overview stats, spending trend, status donut, recent decisions, kill switch |
| `/transactions` | Paginated list + filters, decision detail with the full check trace |
| `/approvals` | Pending approvals with risk gauge, approve / reject |
| `/agents` | Agent cards, pause / resume, register a new agent |
| `/policies` | Three policy cards and a live editor |
| `/merchants` | Reputation list, add / remove |
| `/alerts` | Severity feed with read state |
| `/audit-logs` | Hash-chained append-only trail + raw JSON |
| `/simulation` | Dry-run the real risk engine, five demo scenarios |
| `/settings` | Account, notifications, kill switch, system status |

## Architecture

```
app/
  layout.tsx            fonts + providers
  providers.tsx         SessionProvider + Toaster
  globals.css           all design tokens (CSS custom properties)
  api/auth/[...nextauth]/route.ts
  <route>/page.tsx      one file per screen
components/
  AppShell.tsx          sidebar + topbar + mobile drawer
  ui.tsx                Button, Card, Tag, Switch, Field, Chips, KV,
                        RiskBar, RiskGauge, Banner, EmptyState, ErrorState,
                        Skeleton, Timeline, Pagination, Terminal, StatCard
  Icon.tsx              inline SVG set, no icon dependency
lib/
  auth.ts               NextAuth options (exported from here, NOT from route.ts)
  api.ts                axios client, token cache, 401 retry, envelope unwrap
  hooks.ts              useApi / useApiList / useCounts
  types.ts              response shapes verified against the live backend
  format.ts             money, ago, IST time, risk colour, code humanising
```

### Auth flow

1. `/login` posts to NextAuth `credentials`.
2. `lib/auth.ts` calls `POST /v1/auth/login` and keeps `data.apiToken`.
3. The `jwt` callback stores it on the token; the `session` callback exposes it
   as `session.apiToken`.
4. `lib/api.ts` reads it (cached 30 s) and sets `Authorization: Bearer …` on
   every request. A 401 triggers one retry with a freshly fetched token; if
   that also fails the user is signed out.

### Backend contract notes

Things that are easy to get wrong — all verified against production:

- Kill switch is **`PATCH /v1/kill-switch`**, not POST.
- Transactions filter param is **`decision`**, not `status`.
- `/v1/simulate` needs snake_case: `agent_id`, `merchant: { domain, name }`,
  `amount_usd`, `currency`, `idempotency_key`, `purpose`.
- Only `/v1/transactions` and `/v1/audit-logs` return a `meta` block.
- Every response is wrapped as `{ success, data }` — `apiGet` unwraps it,
  `apiList` keeps `meta` too.

## Verified

Checked with a real browser against the live backend:

- All 11 routes render with production data, zero console errors, zero 401s
- Zero horizontal overflow at 1440 / 1024 / 390 px on every route
- Mobile drawer opens, closes on scrim click and on Escape, locks body scroll
- Wrong password shows an inline error and stays on `/login`
- Logged-out access to a protected route redirects to `/login?callbackUrl=…`
- Pagination changes rows and reads `meta.total`
- Verdict filter returns only the chosen decision
- Kill switch toggles on the server and back
- Simulation returns DENY / 80 for the prompt-injection scenario
- `next build` compiles clean — 15/15 pages
