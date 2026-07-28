import chalk from "chalk";
import { agentA, callMerchant, authorize } from "../agent";
import { header, expected, merchantInfo, asking, decision, result } from "../print";

export async function run(): Promise<boolean> {
  header(2, "An unapproved merchant");
  expected("DENY - this shop is not on the approved list");

  const agent = agentA(); // research-bot-1, Conservative policy
  const offer = await callMerchant(3002); // unknown-service.xyz

  merchantInfo(offer.merchant.domain, offer.merchant.name, offer.amount_usd);
  asking(agent.label, 5);

  const res = await authorize({
    agent,
    merchantDomain: offer.merchant.domain,
    merchantName: offer.merchant.name,
    amountUsd: 5,
    purpose: "fetch dataset",
  });

  decision(res);

  console.log(chalk.dim("Blocked by merchant rule before reaching decision thresholds."));

  const isSuccess = res.decision === "DENY";
  result(
    isSuccess,
    isSuccess
      ? "Transaction blocked due to unknown merchant policy"
      : "Transaction was not denied as expected"
  );

  return isSuccess;
}

if (require.main === module) {
  run().then((ok) => process.exit(ok ? 0 : 1));
}
