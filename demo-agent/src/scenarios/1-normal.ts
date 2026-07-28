import { agentA, callMerchant, authorize, claimResource } from "../agent";
import { header, expected, merchantInfo, asking, decision, result } from "../print";

export async function run(): Promise<boolean> {
  header(1, "A normal payment");
  expected("ALLOW - trusted merchant, small amount, plenty of budget");

  const agent = agentA(); // research-bot-1, Conservative policy
  const offer = await callMerchant(3001); // trusted-api.com

  merchantInfo(offer.merchant.domain, offer.merchant.name, offer.amount_usd);
  asking(agent.label, 2.5);

  const res = await authorize({
    agent,
    merchantDomain: offer.merchant.domain,
    merchantName: offer.merchant.name,
    amountUsd: 2.5,
    purpose: "fetch market data",
  });

  decision(res);

  if (res.decision === "ALLOW" && res.x402_payment) {
    await claimResource(3001, res.x402_payment.signed_payload);
    result(true, "Payment made and the data was delivered");
  } else {
    result(false, "Payment was not allowed as expected");
  }

  return res.decision === "ALLOW";
}

if (require.main === module) {
  run().then((ok) => process.exit(ok ? 0 : 1));
}
