#!/usr/bin/env node
/**
 * policypay CLI
 *
 *   policypay guard -- <your command>
 *
 * Runs your command with a PolicyPay checkpoint injected in front of
 * every outbound HTTP call to a paid vendor. Nothing in the target
 * program changes — we preload a small module into the Node process
 * that patches fetch/http and asks the gateway before letting a
 * request through.
 */

const { spawn } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");

const args = process.argv.slice(2);
const cmd = args[0];

const C = {
  d: (s) => `\x1b[2m${s}\x1b[0m`,
  b: (s) => `\x1b[1m${s}\x1b[0m`,
  g: (s) => `\x1b[32m${s}\x1b[0m`,
  r: (s) => `\x1b[31m${s}\x1b[0m`,
  y: (s) => `\x1b[33m${s}\x1b[0m`,
  c: (s) => `\x1b[36m${s}\x1b[0m`,
};

function help() {
  console.log(`
${C.b("policypay")} — spend guard for AI agents

${C.b("Usage")}
  policypay guard -- <command>     run a command with spend checks in front
  policypay test                   check your keys and reach the gateway
  policypay watch                  print decisions as they happen

${C.b("Examples")}
  ${C.d("# guard any Node program, no code changes")}
  policypay guard -- node agent.js
  policypay guard -- npm run agent

  ${C.d("# guard a coding agent")}
  policypay guard -- claude

${C.b("Setup")}
  Put these in your .env:
    POLICYPAY_API_KEY=pp_live_...
    POLICYPAY_AGENT_ID=...

  Both are on your dashboard under Settings → API keys.

${C.b("Options")}
  --limit <usd>     block anything above this, before even asking
  --dry             log what would happen, block nothing
  --open            allow spending if the gateway is unreachable
`);
}

function loadEnvFile() {
  const p = path.resolve(process.cwd(), ".env");
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (!m) continue;
    const k = m[1];
    let v = (m[2] || "").trim().replace(/^(['"])([\s\S]*)\1$/, "$2");
    if (!(k in process.env)) process.env[k] = v;
  }
}

async function cmdTest() {
  loadEnvFile();
  const { PolicyPay } = require("../dist/index.js");
  console.log(`\n${C.b("PolicyPay setup check")}\n`);

  const key = process.env.POLICYPAY_API_KEY;
  const agent = process.env.POLICYPAY_AGENT_ID;
  const url = process.env.POLICYPAY_URL || "https://policypay-production.up.railway.app";

  const row = (ok, label, extra = "") =>
    console.log(`  ${ok ? C.g("✓") : C.r("✗")} ${label.padEnd(26)} ${C.d(extra)}`);

  row(!!key, "POLICYPAY_API_KEY", key ? key.slice(0, 12) + "…" : "missing");
  row(!!agent, "POLICYPAY_AGENT_ID", agent || "missing");
  row(true, "gateway", url);

  if (!key || !agent) {
    console.log(`\n  ${C.y("Add the missing values to your .env, then run this again.")}\n`);
    process.exit(1);
  }

  let pp;
  try {
    pp = new PolicyPay({ log: false });
  } catch (e) {
    console.log(`\n  ${C.r(e.message)}\n`);
    process.exit(1);
  }

  const up = await pp.ping();
  row(up, "gateway reachable", up ? "" : "cannot connect");
  if (!up) process.exit(1);

  try {
    const r = await pp.check({
      amount: 0.01,
      vendor: "trusted-api.com",
      why: "policypay test",
    });
    row(true, "authorization works", `${r.decision} · risk ${r.risk}`);
    console.log(`\n  ${C.g("All good.")} Try: ${C.c("policypay guard -- node your-agent.js")}\n`);
  } catch (e) {
    row(false, "authorization", `[${e.code}] ${e.message}`);
    process.exit(1);
  }
}

function cmdGuard(rest) {
  loadEnvFile();

  const opts = { limit: null, dry: false, open: false };
  const passthrough = [];
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === "--limit") opts.limit = Number(rest[++i]);
    else if (a === "--dry") opts.dry = true;
    else if (a === "--open") opts.open = true;
    else passthrough.push(a);
  }

  const sep = passthrough.indexOf("--");
  const target = sep >= 0 ? passthrough.slice(sep + 1) : passthrough;

  if (!target.length) {
    console.log(`\n  ${C.r("Nothing to run.")}  Try: ${C.c("policypay guard -- node agent.js")}\n`);
    process.exit(1);
  }
  if (!process.env.POLICYPAY_API_KEY || !process.env.POLICYPAY_AGENT_ID) {
    console.log(
      `\n  ${C.r("Missing credentials.")} Add POLICYPAY_API_KEY and POLICYPAY_AGENT_ID to your .env.` +
        `\n  Run ${C.c("policypay test")} to verify.\n`
    );
    process.exit(1);
  }

  const preload = path.join(__dirname, "..", "dist", "preload.cjs");

  console.log(
    `\n  ${C.g("●")} ${C.b("PolicyPay guard active")}  ${C.d(
      `${opts.dry ? "dry-run · " : ""}${opts.limit ? `hard limit $${opts.limit} · ` : ""}` +
        `${opts.open ? "fail-open" : "fail-closed"}`
    )}\n  ${C.d("running:")} ${target.join(" ")}\n`
  );

  const existing = process.env.NODE_OPTIONS || "";
  const child = spawn(target[0], target.slice(1), {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: {
      ...process.env,
      NODE_OPTIONS: `${existing} --require ${JSON.stringify(preload)}`.trim(),
      POLICYPAY_GUARD: "1",
      POLICYPAY_GUARD_LIMIT: opts.limit != null ? String(opts.limit) : "",
      POLICYPAY_GUARD_DRY: opts.dry ? "1" : "",
      POLICYPAY_GUARD_OPEN: opts.open ? "1" : "",
    },
  });

  child.on("exit", (code, sig) => {
    if (sig) process.kill(process.pid, sig);
    else process.exit(code ?? 0);
  });
  child.on("error", (err) => {
    console.log(`\n  ${C.r("Could not start:")} ${target[0]} — ${err.message}\n`);
    process.exit(1);
  });
}

(async () => {
  if (!cmd || cmd === "help" || cmd === "--help" || cmd === "-h") return help();
  if (cmd === "test") return cmdTest();
  if (cmd === "guard") return cmdGuard(args.slice(1));
  if (cmd === "--version" || cmd === "-v")
    return console.log(require("../package.json").version);
  console.log(`\n  Unknown command ${C.r(cmd)}. Run ${C.c("policypay help")}.\n`);
  process.exit(1);
})();
