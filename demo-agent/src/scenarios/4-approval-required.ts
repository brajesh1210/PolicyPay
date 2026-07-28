import chalk from "chalk";
import { agentB, callMerchant, authorize } from "../agent";
import { header, expected, merchantInfo, asking, decision, result } from "../print";

// Note: We use agentB (highvalue-bot-1, Aggressive policy) because Conservative agentA
// would hit the $5 per-transaction limit first, which would be DENIED instead of REQUIRE_APPROVAL.
export async function run(): Promise<boolean> {
  header(4, "A large payment needs a human");
  expected("REQUIRE_APPROVAL - 45 dollars is 9x this agent's normal spend");

  const agent = agentB(); // highvalue-bot-1, Aggressive policy
  const offer = await callMerchant(3001); // trusted-api.com

  merchantInfo(offer.merchant.domain, offer.merchant.name, offer.amount_usd);
  asking(agent.label, 45);

  const res = await authorize({
    agent,
    merchantDomain: offer.merchant.domain,
    merchantName: offer.merchant.name,
    amountUsd: 45,
    purpose: "bulk historical data purchase",
  });

  decision(res);

  if (res.approval_id) {
    console.log(chalk.bold.yellow("\nA human must now approve this.\n"));
    console.log(chalk.yellow("Open the PolicyPay dashboard -> Approvals, and click Approve.\n"));
    console.log(chalk.yellow(`Approval id: ${res.approval_id}\n`));
  }

  const isSuccess = res.decision === "REQUIRE_APPROVAL";
  result(
    isSuccess,
    isSuccess
      ? "Transaction correctly flagged for human approval"
      : "Transaction was not flagged for human approval"
  );

  return isSuccess;
}

if (require.main === module) {
  run().then((ok) => process.exit(ok ? 0 : 1));
}
