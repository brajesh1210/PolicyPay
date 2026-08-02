# Installation

Three levels, depending on how much you need running.

| I want to… | Go to |
|---|---|
| Guard my own agent against the hosted API | [Use the SDK](#1-use-the-sdk) |
| Run the dashboard against the hosted API | [Dashboard only](#2-dashboard-only) |
| Run everything on my machine | [The whole stack](#3-the-whole-stack) |

---

## Requirements

| | Version | Needed for |
|---|---|---|
| Node.js | 18 or newer | everything |
| npm | 9 or newer | workspaces |
| Docker | any recent | Postgres + Redis, local only |

---

## 1. Use the SDK

Nothing to clone.

```bash
npm install policypay
```

Get a key from the dashboard → **Connect** → pick an agent → **Create key**.

`.env`:

```env
POLICYPAY_API_KEY=pp_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
POLICYPAY_AGENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxx
```

Check it:

```bash
npx policypay test
```

```
  ✓ POLICYPAY_API_KEY          pp_live_a3cb…
  ✓ POLICYPAY_AGENT_ID         cms36q3ez0005su8ruhidbwl7
  ✓ gateway reachable
  ✓ authorization works        ALLOW · risk 0
```

Then either put a check in your code:

```js
import { PolicyPay } from "policypay";
const pp = new PolicyPay();

const ok = await pp.check({ amount: 4.99, vendor: "openai" });
if (!ok.allowed) return;
```

Or wrap the command and change nothing:

```bash
npx policypay guard -- node your-agent.js
```

---

## 2. Dashboard only

Runs the UI locally against the deployed API. No database needed.

```bash
git clone https://github.com/brajesh1210/PolicyPay.git
cd PolicyPay
npm install
```

`frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=https://policypay-production.up.railway.app
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=policypay-nextauth-dev-secret
API_JWT_SECRET=policypay-dev-secret-change-me
```

```bash
cd frontend
npm run dev
```

http://localhost:3000 — sign in with `admin@policypay.demo` / `Demo1234!`

> `API_JWT_SECRET` must match the backend's, or the dashboard will sign
> tokens the API refuses.

---

## 3. The whole stack

### Start the databases

```bash
docker compose up -d
docker ps          # policypay-postgres and policypay-redis should both be up
```

> **Port 5432 already taken?** A Windows install of PostgreSQL often
> holds it. Change the mapping in `docker-compose.yml` to `"5433:5432"`
> and use 5433 in `DATABASE_URL`. Keep the change out of git with
> `git update-index --skip-worktree docker-compose.yml`.

### Backend

`backend/.env`:

```env
NODE_ENV=development
PORT=8080
DATABASE_URL=postgresql://policypay:policypay@localhost:5432/policypay
REDIS_URL=redis://localhost:6379
API_JWT_SECRET=policypay-dev-secret-change-me
CORS_ORIGIN=http://localhost:3000
X402_NETWORK=base-sepolia
APPROVAL_EXPIRY_MINUTES=30
DUPLICATE_GUARD_TTL_SECONDS=600
```

From the repo root:

```bash
npm install
npx prisma generate --schema backend/prisma/schema.prisma
npm run build --workspace @policypay/contracts
cd backend
npm run build
npx prisma migrate deploy --schema prisma/schema.prisma
npm run seed
```

The seed prints two agent ids and two API keys. **Copy them** — they are
shown once.

```bash
npm run start
```

http://localhost:8080/health should return `{"ok":true,…}`

### Frontend

`frontend/.env.local` — same as above but pointing at localhost:

```env
NEXT_PUBLIC_API_URL=http://localhost:8080
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=policypay-nextauth-dev-secret
API_JWT_SECRET=policypay-dev-secret-change-me
```

```bash
cd frontend
npm run dev
```

### The demo agent

`demo-agent/.env`, using the seed output:

```env
POLICYPAY_API_URL=http://localhost:8080
AGENT_A_ID=<research-bot-1 agent id>
AGENT_A_KEY=<research-bot-1 api key>
AGENT_B_ID=<highvalue-bot-1 agent id>
AGENT_B_KEY=<highvalue-bot-1 api key>
```

Two terminals:

```bash
# terminal 1 — mock merchants that speak HTTP 402
cd demo-agent
npm run merchants

# terminal 2
cd demo-agent
npm run demo
```

Expected:

```
1  A normal payment                 ALLOW      ok
2  An unapproved merchant           DENY       ok
3  A prompt injection attempt       DENY       ok
4  A large payment needs a human    APPROVAL   ok
5  The daily budget runs out        DENY       ok
```

---

## Environment variables

### `backend/.env`

| Variable | Example | Notes |
|---|---|---|
| `NODE_ENV` | `development` | |
| `PORT` | `8080` | |
| `DATABASE_URL` | `postgresql://policypay:policypay@localhost:5432/policypay` | |
| `REDIS_URL` | `redis://localhost:6379` | |
| `API_JWT_SECRET` | any string | **must match the frontend** |
| `CORS_ORIGIN` | `http://localhost:3000` | |
| `X402_NETWORK` | `base-sepolia` | |
| `APPROVAL_EXPIRY_MINUTES` | `30` | held payments expire after this |
| `DUPLICATE_GUARD_TTL_SECONDS` | `600` | replay window |

### `frontend/.env.local`

| Variable | Notes |
|---|---|
| `NEXT_PUBLIC_API_URL` | where the backend lives |
| `NEXTAUTH_URL` | the app's own URL — the deployed URL in production, not localhost |
| `NEXTAUTH_SECRET` | session signing |
| `API_JWT_SECRET` | must match the backend |
| `GOOGLE_CLIENT_ID` | optional — Google sign-in |
| `GOOGLE_CLIENT_SECRET` | optional |

### Agent-side

| Variable | Notes |
|---|---|
| `POLICYPAY_API_KEY` | `pp_live_…` |
| `POLICYPAY_AGENT_ID` | must belong to that key |
| `POLICYPAY_URL` | defaults to the hosted gateway |

---

## When it does not work

**`Cannot find module '@prisma/client'`**

npm hoisting plus a Prisma major bump. Pin both to `5.22.0` with no
caret, delete `node_modules` and `package-lock.json` at the **root**,
and reinstall from the root.

**`P1001: Can't reach database server`**

Docker is not running, or the port in `DATABASE_URL` does not match
`docker-compose.yml`.

**`Environment variable not found: DATABASE_URL` during seed**

The Prisma CLI loads `.env` on its own; a plain `ts-node` script does
not. `backend/prisma/seed.ts` calls `dotenv.config()` at the top for
exactly this reason — make sure those two lines are still there.

**`401 Invalid API key` from the demo agent**

Every `npm run seed` issues new keys and revokes the old ones. Copy the
fresh values from the seed output into `demo-agent/.env`.

**`Error connecting to merchant server on port 3001`**

`npm run merchants` needs to be running in its own terminal.

**Scenario 5 never hits the budget**

Counters are still full from a previous run:

```bash
npm run reset:counters --workspace backend
```

Run it wherever the backend is pointed. Running it locally will not
touch a hosted Redis.

**Dashboard shows "Network Error" everywhere**

The browser cannot resolve the API domain. The dashboard proxies through
`/api/gateway/*` to avoid this — confirm `frontend/next.config.js` still
has the rewrite, and that `NEXT_PUBLIC_API_URL` is set.

---

## Repo layout

```
policypay/
├── backend/          Express API, Prisma schema, seed
├── frontend/         Next.js dashboard
├── packages/
│   ├── sdk/          the npm package + CLI
│   └── contracts/    shared zod schemas
├── examples/agent/   guarded and unguarded examples
├── demo-agent/       the five scenarios
└── docs/
```

npm workspaces — always `npm install` from the **root**, never inside a
package.
