import chalk from "chalk";
import { agentA, callMerchant, authorize, AuthorizeResult } from "../agent";
import { header, expected, merchantInfo, asking, decision, result } from "../print";

export async function run(): Promise<boolean> {
  header(5, "The daily budget runs out");
  expected("The first few payments succeed, then one is DENIED for budget");

  const agent = agentA(); // research-bot-1, Conservative policy (daily budget: $20)
  const offer = await callMerchant(3001); // trusted-api.com

  merchantInfo(offer.merchant.domain, offer.merchant.name, 4);
  asking(agent.label, 4);

  let totalAllowed = 0;
  let lastResult: AuthorizeResult | null = null;
  let budgetDenied = false;

  for (let attempt = 1; attempt <= 10; attempt++) {
    console.log(chalk.dim(`Attempt ${attempt}...`));

    const res = await authorize({
      agent,
      merchantDomain: offer.merchant.domain,
      merchantName: offer.merchant.name,
      amountUsd: 4,
      purpose: "bulk data fetch",
    });

    lastResult = res;

    if (res.decision === "ALLOW") {
      totalAllowed += 4;
      console.log(
        `attempt ${attempt} -> ${chalk.green("ALLOW")} (spent so far $${totalAllowed.toFixed(2)})`
      );
      await new Promise((resolve) => setTimeout(resolve, 400));
    } else if (res.decision === "DENY") {
      decision(res);
      if (res.reason_codes && res.reason_codes.includes("DAILY_BUDGET_EXCEEDED")) {
        budgetDenied = true;
      }
      break;
    } else {
      decision(res);
      break;
    }
  }

  if (!budgetDenied && lastResult?.decision !== "DENY") {
    console.error(
      chalk.red(
        "\n❌ Error: 10 attempts executed without hitting daily budget limit.\n" +
          "The budget counters were probably not reset. Ask Brajesh to run:\n" +
          "  npm run reset:counters\n"
      )
    );
  }

  result(
    budgetDenied,
    budgetDenied
      ? "Daily budget limit successfully enforced"
      : "Daily budget limit was not hit"
  );

  return budgetDenied;
}

if (require.main === module) {
  run().then((ok) => process.exit(ok ? 0 : 1));
}
