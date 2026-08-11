/**
 * A coding agent, the way you'd actually meet one.
 *
 * It takes a task, plans it, writes files, and along the way it needs to
 * buy three things. Every purchase goes through PolicyPay first — and the
 * verdicts are real, from the live gateway.
 *
 *   npm start
 *
 * Nothing here is scripted to pass. If the policy says no, the agent stops.
 */

import "dotenv/config";
import { PolicyPay } from "policypay";
import readline from "node:readline";

// ── terminal paint ───────────────────────────────────────────
const C = {
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  b: (s) => `\x1b[1m${s}\x1b[0m`,
  g: (s) => `\x1b[32m${s}\x1b[0m`,
  r: (s) => `\x1b[31m${s}\x1b[0m`,
  y: (s) => `\x1b[33m${s}\x1b[0m`,
  bl: (s) => `\x1b[34m${s}\x1b[0m`,
  cy: (s) => `\x1b[36m${s}\x1b[0m`,
  mag: (s) => `\x1b[35m${s}\x1b[0m`,
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const W = Math.min(process.stdout.columns || 80, 84);
const rule = (ch = "─") => console.log(C.dim(ch.repeat(W)));

async function type(text, ms = 11) {
  for (const ch of text) {
    process.stdout.write(ch);
    await sleep(ms);
  }
  process.stdout.write("\n");
}

/** A spinner that runs while some promise settles. */
async function spin(label, promise) {
  const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  let i = 0;
  const t = setInterval(() => {
    process.stdout.write(`\r  ${C.cy(frames[i++ % frames.length])} ${C.dim(label)}`);
  }, 80);
  try {
    return await promise;
  } finally {
    clearInterval(t);
    process.stdout.write("\r" + " ".repeat(label.length + 6) + "\r");
  }
}

function box(title, lines) {
  console.log(C.dim("  ┌─ ") + C.b(title));
  for (const l of lines) console.log(C.dim("  │  ") + l);
  console.log(C.dim("  └" + "─".repeat(Math.max(10, title.length + 2))));
}

// ── the agent ────────────────────────────────────────────────

const pp = new PolicyPay();

const procurement =
  process.env.POLICYPAY_PROCUREMENT_KEY && process.env.POLICYPAY_PROCUREMENT_AGENT_ID
    ? new PolicyPay({
        apiKey: process.env.POLICYPAY_PROCUREMENT_KEY,
        agentId: process.env.POLICYPAY_PROCUREMENT_AGENT_ID,
      })
    : pp;

let spent = 0;
let bought = 0;
let blocked = 0;
let held = null;

/**
 * The agent decides it needs to buy something. This is the only place
 * money can leave, and PolicyPay sits in front of it.
 */
async function purchase({ what, amount, vendor, why, client = pp }) {
  console.log();
  await type(`${C.bl("●")} ${C.b(what)}`, 9);
  console.log(C.dim(`   ${vendor} · $${amount.toFixed(2)}`));
  await sleep(300);

  const r = await spin("checking with PolicyPay…", client.check({ amount, vendor, why }));
  await sleep(150);

  if (r.allowed) {
    console.log(`  ${C.g("✔ allowed")}  ${C.dim(`risk ${r.risk}/100 · ${r.transactionId.slice(0, 12)}…`)}`);
    spent += amount;
    bought++;
    await sleep(200);
    console.log(C.dim(`   purchased. carrying on.`));
    return true;
  }

  if (r.needsApproval) {
    console.log(`  ${C.y("⏸ needs a human")}  ${C.dim(`risk ${r.risk}/100`)}`);
    for (const c of r.reasons) console.log(C.dim(`     · ${c}`));
    held = { ...r, what, amount };
    return false;
  }

  console.log(`  ${C.r("✖ blocked")}  ${C.dim(`risk ${r.risk}/100`)}`);
  for (const c of r.reasons) console.log(C.dim(`     · ${c}`));
  const failed = r.checks.filter((c) => !c.passed);
  for (const c of failed) console.log(C.dim(`     · ${c.check}: ${c.detail}`));
  blocked++;
  await sleep(200);
  console.log(C.dim(`   skipping. I'll find another way.`));
  return false;
}

/** Cosmetic — the agent "writing" a file. */
async function writeFile(path, note) {
  await type(`${C.mag("✎")} ${C.dim("writing")} ${path}`, 7);
  await sleep(220);
  console.log(C.dim(`   ${note}`));
}

// ── run ──────────────────────────────────────────────────────

async function main() {
  console.clear();
  rule("━");
  console.log(`  ${C.b("coding agent")}  ${C.dim("· guarded by PolicyPay")}`);
  rule("━");
  console.log();

  await type(C.dim("task: ") + C.b("build a weather dashboard for my city"), 14);
  console.log();
  await sleep(500);

  await type(C.dim("Let me plan this out."), 12);
  await sleep(300);
  box("plan", [
    "1. a weather data feed",
    "2. a place to cache readings",
    "3. hosting for a year",
    "4. wire it together",
  ]);
  await sleep(700);

  // ── 1. small, trusted, sensible → ALLOW
  await purchase({
    what: "I need a weather data feed",
    amount: 5.0,
    vendor: "trusted-api.com",
    why: "hourly forecast endpoint",
    client: procurement,
  });
  await sleep(400);
  await writeFile("src/weather.ts", "fetches the hourly forecast");
  await sleep(600);

  // A couple more ordinary buys. These matter: the risk engine compares
  // every amount against this agent's own recent average, so a handful of
  // small purchases is what makes the big one stand out later.
  await purchase({
    what: "I need a geocoding lookup",
    amount: 5.0,
    vendor: "trusted-api.com",
    why: "turn the city name into coordinates",
    client: procurement,
  });
  await sleep(500);

  await purchase({
    what: "I need an air-quality feed",
    amount: 5.0,
    vendor: "trusted-api.com",
    why: "AQI panel on the dashboard",
    client: procurement,
  });
  await sleep(400);
  await writeFile("src/aqi.ts", "pulls the AQI reading");
  await sleep(600);

  // ── 2. unknown vendor → DENY
  await purchase({
    what: "I found a cheap database vendor",
    amount: 3.0,
    vendor: "shady-payments.com",
    why: "managed postgres, cheapest I could find",
  });
  await sleep(400);
  await type(C.dim("   falling back to a local SQLite file instead."), 10);
  await writeFile("src/cache.ts", "SQLite, no vendor needed");
  await sleep(600);

  // ── 3. big ticket → REQUIRE_APPROVAL
  await purchase({
    what: "I need hosting, a year paid upfront",
    amount: 45.0,
    vendor: "trusted-api.com",
    why: "annual hosting plan, discounted yearly",
    client: procurement,
  });

  console.log();
  rule();

  if (held) {
    console.log(`  ${C.y("⏸ waiting for a human")}`);
    console.log(C.dim(`     approval  ${held.approvalId ?? "—"}`));
    console.log(C.dim(`     amount    $${held.amount.toFixed(2)}`));
    console.log();
    console.log(C.dim("  Open the dashboard → Approvals and click Approve."));
    console.log(C.dim("  I'll keep checking."));
    console.log();

    const ok = await waitForApproval(held.approvalId);

    if (ok === true) {
      console.log();
      console.log(`  ${C.g("✔ approved by a human")} ${C.dim("— continuing")}`);
      spent += held.amount;
      bought++;
      await sleep(400);
      await writeFile("deploy.yml", "hosting configured");
    } else if (ok === false) {
      console.log();
      console.log(`  ${C.r("✖ rejected by a human")} ${C.dim("— I'll use the free tier")}`);
      blocked++;
      await writeFile("deploy.yml", "free tier, no payment needed");
    } else {
      console.log();
      console.log(C.dim("  Nobody answered. Leaving it for later."));
    }
  }

  console.log();
  rule("━");
  console.log(
    `  ${C.b("done")}   ${C.dim(
      `${bought} purchase${bought === 1 ? "" : "s"} · ${blocked} stopped · $${spent.toFixed(2)} spent`
    )}`
  );
  console.log(C.dim("  Every decision is on the dashboard, with the reason."));
  rule("━");
  console.log();
}

/**
 * Poll until a human decides.
 *
 * Agent API keys only work on the authorize endpoint, so to read approval
 * status we log in with the dashboard account. In a real deployment you'd
 * expose a small agent-facing status endpoint instead.
 *
 * Returns true (approved), false (rejected) or null (timed out).
 */
async function waitForApproval(approvalId, maxSeconds = 180) {
  const base = (process.env.POLICYPAY_URL || "https://policypay-production.up.railway.app").replace(/\/+$/, "");
  const email = process.env.POLICYPAY_DASHBOARD_EMAIL;
  const password = process.env.POLICYPAY_DASHBOARD_PASSWORD;

  if (!approvalId || !email || !password) {
    console.log(
      C.dim(
        "  (set POLICYPAY_DASHBOARD_EMAIL and POLICYPAY_DASHBOARD_PASSWORD\n" +
          "   in .env to have me wait for the decision live)"
      )
    );
    return null;
  }

  let token;
  try {
    const res = await fetch(`${base}/v1/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    token = (await res.json())?.data?.apiToken;
  } catch {
    /* fall through */
  }
  if (!token) {
    console.log(C.dim("  (could not sign in to watch for the decision)"));
    return null;
  }

  const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  const started = Date.now();
  let i = 0;

  while ((Date.now() - started) / 1000 < maxSeconds) {
    const secs = Math.floor((Date.now() - started) / 1000);
    process.stdout.write(`\r  ${C.y(frames[i++ % frames.length])} ${C.dim(`waiting for approval… ${secs}s`)}`);

    try {
      const res = await fetch(`${base}/v1/approvals?limit=50`, {
        headers: { authorization: `Bearer ${token}` },
      });
      const body = await res.json();
      const rows = Array.isArray(body?.data) ? body.data : body?.data?.items ?? [];
      const row = rows.find((r) => r.id === approvalId);
      if (row && row.status !== "PENDING") {
        process.stdout.write("\r" + " ".repeat(46) + "\r");
        return row.status === "APPROVED";
      }
    } catch {
      /* keep polling */
    }
    await sleep(2500);
  }

  process.stdout.write("\r" + " ".repeat(46) + "\r");
  return null;
}

main().catch((e) => {
  console.error(`\n  ${C.r("error")} ${e.message}\n`);
  process.exit(1);
});
