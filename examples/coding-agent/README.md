# coding-agent

A coding agent that asks PolicyPay before it spends. Built for the demo
video, but nothing here is faked — every verdict comes from the live
gateway.

```bash
npm install
cp .env.example .env      # paste your keys
npm start
```

## What it does

Takes a task ("build a weather dashboard"), plans it, writes files, and
needs to buy four things along the way:

| Purchase | Amount | What happens |
|---|---|---|
| Weather feed | $5 | **allowed** |
| Geocoding | $5 | **allowed** |
| Air quality | $5 | **allowed** |
| Cheap database | $3 | **blocked** — vendor not on the allowlist |
| Annual hosting | $45 | **held for a human** — 9× its own average |

The three small buys are not filler. The risk engine compares every
amount against this agent's own recent average, so those purchases are
what make the $45 one stand out.

## The moment worth filming

When it hits the hosting bill the agent stops and waits:

```
  ⏸ waiting for a human
     approval  cmsbd8sdq005311ddltjd9n5d
     amount    $45.00

  Open the dashboard → Approvals and click Approve.
  ⠹ waiting for approval… 12s
```

Click **Approve** on the dashboard and the terminal picks it up within
a few seconds:

```
  ✔ approved by a human — continuing
✎ writing deploy.yml
```

Reject it instead and the agent falls back to the free tier. Either way
it keeps going.

## Setup notes

- **Use a fresh agent.** The $45 purchase only escalates if the agent's
  average is low. An agent that has already made big purchases will just
  allow it. Create a new one from the dashboard for the recording.
- `POLICYPAY_DASHBOARD_EMAIL` / `PASSWORD` are optional. Without them the
  agent prints the approval id and moves on instead of waiting live.
