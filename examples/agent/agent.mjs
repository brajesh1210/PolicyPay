/**
 * A small coding agent that builds a weather app.
 *
 * It genuinely needs to buy three things. Each purchase goes through
 * PolicyPay first. Nothing here is faked — the decisions come from the
 * live gateway.
 *
 *   node agent.mjs
 */

import "dotenv/config";
import { PolicyPay } from "policypay";

// Most work runs on the everyday agent (tight limits).
// Big-ticket items are raised by the procurement agent, which has a
// larger per-transaction cap but escalates to a human.

// ── tiny terminal helpers ────────────────────────────────────
const C = {
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  b: (s) => `\x1b[1m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  blue: (s) => `\x1b[34m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function type(text, ms = 14) {
  for (const ch of text) {
    process.stdout.write(ch);
    await sleep(ms);
  }
  process.stdout.write("\n");
}

function rule() {
  console.log(C.dim("─".repeat(64)));
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

/**
 * Ask PolicyPay, print the verdict the way a coding agent would
 * narrate it, and report back whether to proceed.
 */
async function needToBuy({ what, amount, vendor, why, client = pp }) {
  await type(`${C.blue("●")} I need ${C.b(what)} ${C.dim(`— $${amount.toFixed(2)} from ${vendor}`)}`);
  process.stdout.write(C.dim("  asking PolicyPay… "));

  const r = await client.check({ amount, vendor, why });

  process.stdout.write("\r" + " ".repeat(30) + "\r");

  if (r.allowed) {
    console.log(`  ${C.green("✓ approved")} ${C.dim(`risk ${r.risk}/100`)}`);
    await sleep(250);
    console.log(`  ${C.dim("purchased. continuing.")}\n`);
    return true;
  }

  if (r.needsApproval) {
    console.log(`  ${C.yellow("⏸ needs a human")} ${C.dim(`risk ${r.risk}/100 · ${r.reasons.join(", ")}`)}`);
    console.log(`  ${C.dim(`approval id ${r.approvalId ?? "—"}`)}`);
    console.log(`  ${C.yellow("waiting for someone to approve this on the dashboard.")}\n`);
    return false;
  }

  console.log(`  ${C.red("✗ blocked")} ${C.dim(`risk ${r.risk}/100`)}`);
  for (const code of r.reasons) console.log(`    ${C.red("·")} ${C.dim(code)}`);
  const failed = r.checks.filter((c) => !c.passed);
  for (const c of failed) console.log(`    ${C.red("·")} ${C.dim(`${c.check}: ${c.detail}`)}`);
  console.log(`  ${C.dim("skipping this one.")}\n`);
  return false;
}

async function main() {
  console.clear();
  rule();
  console.log(`  ${C.b("weather-app agent")}   ${C.dim("task: build a weather dashboard")}`);
  rule();
  console.log();

  await type(C.dim("Planning. I'll need a weather feed, a database, and hosting."));
  console.log();
  await sleep(400);

  let bought = 0;

  // 1 — small, trusted, sensible. Should sail through.
  if (
    await needToBuy({
      what: "a weather data feed",
      amount: 2.0,
      vendor: "trusted-api.com",
      why: "hourly forecast endpoint for the dashboard",
    })
  )
    bought++;

  await sleep(500);

  // 2 — a vendor nobody approved. Should be refused.
  if (
    await needToBuy({
      what: "a cheap database from a vendor I found",
      amount: 3.0,
      vendor: "shady-payments.com",
      why: "managed postgres, cheapest option I could find",
    })
  )
    bought++;

  await sleep(500);

  // 3 — large enough that a human should look at it.
  if (
    await needToBuy({
      what: "a year of hosting, paid upfront",
      amount: 90.0,
      vendor: "trusted-api.com",
      why: "annual hosting plan, discounted if paid yearly",
      client: procurement,
    })
  )
    bought++;

  rule();
  console.log(
    `  ${C.b("done")}  ${C.dim(`${bought} of 3 purchases went through`)}`
  );
  console.log(`  ${C.dim("every decision is on the dashboard, with reasons.")}`);
  rule();
  console.log();
}

main().catch((e) => {
  console.error(`\n  ${C.red("error")} ${e.message}\n`);
  process.exit(1);
});
