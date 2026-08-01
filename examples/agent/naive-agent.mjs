/**
 * The same kind of agent — except this one has never heard of PolicyPay.
 * There is no import, no API key, no check. It just spends.
 *
 * Run it bare and it spends freely:
 *     node naive-agent.mjs
 *
 * Run it behind the guard and every paid call is authorised first,
 * without changing a single line in this file:
 *     npx policypay guard -- node naive-agent.mjs
 */

const C = {
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  b: (s) => `\x1b[1m${s}\x1b[0m`,
  blue: (s) => `\x1b[34m${s}\x1b[0m`,
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function buy(label, url) {
  console.log(`${C.blue("●")} I need ${C.b(label)}`);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ demo: true }),
    });
    console.log(`  ${C.dim(`vendor replied ${res.status}. continuing.`)}\n`);
  } catch (e) {
    console.log(`  ${C.dim(`could not: ${e.message}`)}\n`);
  }
  await sleep(400);
}

console.log(C.dim("─".repeat(64)));
console.log(`  ${C.b("legacy agent")}   ${C.dim("no PolicyPay code anywhere in this file")}`);
console.log(C.dim("─".repeat(64)) + "\n");

await buy("model tokens", "https://api.openai.com/v1/chat/completions");
await buy("a database from a vendor I found", "https://shady-payments.com/checkout");
await buy("to read my own config", "http://localhost:9999/config");

console.log(C.dim("─".repeat(64)));
console.log(`  ${C.b("done")}`);
console.log(C.dim("─".repeat(64)) + "\n");
