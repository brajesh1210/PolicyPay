import chalk from "chalk";
import { AuthorizeResult } from "./agent";

export const REASON_TEXT: Record<string, string> = {
  KILL_SWITCH_ACTIVE: "Global kill switch is on",
  AGENT_KILL_SWITCH_ACTIVE: "This agent's kill switch is on",
  AGENT_INACTIVE: "The agent is inactive",
  POLICY_DISABLED: "The agent's policy is disabled",
  DUPLICATE_INTENT: "Duplicate payment blocked (replay guard)",
  MERCHANT_BLOCKED: "Merchant is on the blocked list",
  MERCHANT_NOT_ALLOWED: "Unknown merchant, and this policy blocks unknown merchants",
  CATEGORY_BLOCKED: "This merchant category is not allowed",
  PER_TX_LIMIT_EXCEEDED: "Amount is over the per-transaction limit",
  DAILY_BUDGET_EXCEEDED: "Daily budget is used up",
  MONTHLY_BUDGET_EXCEEDED: "Monthly budget is used up",
  HOURLY_FREQUENCY_EXCEEDED: "Too many payments this hour",
  DAILY_FREQUENCY_EXCEEDED: "Too many payments today",
  UNKNOWN_MERCHANT_RISK: "Unknown merchant added risk",
  AMOUNT_ANOMALY: "Amount is unusually large for this agent",
  FREQUENCY_BURST: "Several payments in a short time",
  OFF_HOURS: "Outside the allowed hours",
  PROMPT_INJECTION_SUSPECTED: "The purpose text looks like a prompt injection",
  RISK_THRESHOLD_DENY: "Risk score too high, blocked",
  RISK_THRESHOLD_APPROVAL: "Risk score high, needs human approval",
  ALL_CHECKS_PASSED: "All checks passed",
};

const WIDTH = 74;

export function header(n: number, title: string): void {
  const line = "=".repeat(WIDTH);
  console.log("");
  console.log(chalk.cyan(line));
  console.log(chalk.bold.cyan(` SCENARIO ${n}: ${title.toUpperCase()}`));
  console.log(chalk.cyan(line));
}

export function step(text: string): void {
  console.log(chalk.dim(`-> ${text}`));
}

export function merchantInfo(domain: string, name: string, amount: number): void {
  console.log(chalk.gray(`  Merchant : `) + chalk.white(`${name} (${domain})`));
  console.log(chalk.gray(`  Price    : `) + chalk.yellow(`$${amount.toFixed(2)} USDC`));
  console.log(chalk.gray(`  Response : `) + chalk.magenta(`HTTP 402 Payment Required`));
}

export function asking(agentLabel: string, amount: number): void {
  console.log(
    chalk.bold.blue(`Agent `) +
      chalk.bold.white(agentLabel) +
      chalk.bold.blue(` is asking PolicyPay for permission to pay `) +
      chalk.bold.yellow(`$${amount.toFixed(2)}`)
  );
}

export function decision(result: AuthorizeResult): void {
  console.log("");

  // Big Decision Badge
  if (result.decision === "ALLOW") {
    console.log(chalk.bgGreen.bold.white("  ALLOW  "));
  } else if (result.decision === "DENY") {
    console.log(chalk.bgRed.bold.white("  DENY  "));
  } else {
    console.log(chalk.bgYellow.bold.black("  NEEDS HUMAN APPROVAL  "));
  }

  // Risk score
  let scoreColor = chalk.green;
  if (result.risk_score >= 70) {
    scoreColor = chalk.red;
  } else if (result.risk_score >= 30) {
    scoreColor = chalk.yellow;
  }

  console.log(
    chalk.bold("  Risk score : ") + scoreColor.bold(`${result.risk_score} / 100`)
  );

  // Reason codes
  if (result.reason_codes && result.reason_codes.length > 0) {
    console.log(chalk.bold("  Reasons    :"));
    for (const code of result.reason_codes) {
      const friendly = REASON_TEXT[code] || code;
      console.log(`    - ${chalk.yellow(code)} : ${chalk.white(friendly)}`);
    }
  }

  // Policy Checks (up to 6)
  if (result.policy_checks && result.policy_checks.length > 0) {
    console.log(chalk.bold("  Checks     :"));
    const checksToDisplay = result.policy_checks.slice(0, 6);
    for (const chk of checksToDisplay) {
      const symbol = chk.passed ? chalk.green("✔") : chalk.red("✖");
      const detailStr = chk.detail ? chalk.gray(` (${chk.detail})`) : "";
      console.log(`    ${symbol} ${chalk.white(chk.check)}${detailStr}`);
    }
  }

  // Risk breakdown
  if (result.risk_breakdown && result.risk_breakdown.length > 0) {
    console.log(chalk.bold("  Risk from  :"));
    for (const factor of result.risk_breakdown) {
      const detailStr = factor.detail ? chalk.gray(` (${factor.detail})`) : "";
      console.log(
        `    - ${chalk.cyan(factor.factor)}: ${chalk.red("+" + factor.points + " pts")}${detailStr}`
      );
    }
  }

  // Approval ID if present
  if (result.approval_id) {
    console.log(
      chalk.bold.yellow(`  Approval ID : ${result.approval_id} `) +
        chalk.yellow(`(waiting for a human on the Approvals page)`)
    );
  }

  // x402 payment payload if present
  if (result.x402_payment) {
    const payloadPreview = result.x402_payment.signed_payload.slice(0, 24) + "...";
    console.log(
      chalk.bold.green(`  x402 Proof  : `) +
        chalk.green(`${payloadPreview} `) +
        chalk.dim(`[network: ${result.x402_payment.network}]`)
    );
  }

  console.log("");
}

export function expected(text: string): void {
  console.log(chalk.dim(`expected: ${text}`));
}

export function result(ok: boolean, text: string): void {
  if (ok) {
    console.log(chalk.bold.green(`✔ ${text}`));
  } else {
    console.log(chalk.bold.red(`✖ ${text}`));
  }
}
