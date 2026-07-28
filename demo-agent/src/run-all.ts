import chalk from "chalk";
import { run as runScenario1 } from "./scenarios/1-normal";
import { run as runScenario2 } from "./scenarios/2-unknown-merchant";
import { run as runScenario3 } from "./scenarios/3-budget-exceeded";
import { run as runScenario4 } from "./scenarios/4-approval-required";
import { run as runScenario5 } from "./scenarios/5-prompt-injection";

interface ScenarioItem {
  id: number;
  title: string;
  expectedDecision: string;
  runFn: () => Promise<boolean>;
}

const ALL_SCENARIOS: ScenarioItem[] = [
  {
    id: 1,
    title: "A normal payment",
    expectedDecision: "ALLOW",
    runFn: runScenario1,
  },
  {
    id: 2,
    title: "An unapproved merchant",
    expectedDecision: "DENY",
    runFn: runScenario2,
  },
  {
    id: 3,
    title: "A prompt injection attempt",
    expectedDecision: "DENY",
    runFn: runScenario5,
  },
  {
    id: 4,
    title: "A large payment needs a human",
    expectedDecision: "APPROVAL",
    runFn: runScenario4,
  },
  {
    id: 5,
    title: "The daily budget runs out",
    expectedDecision: "DENY",
    runFn: runScenario3,
  },
];

async function main() {
  console.log("");
  console.log(chalk.bold.cyan("=========================================================="));
  console.log(chalk.bold.white("               PolicyPay - live demo                      "));
  console.log(chalk.dim("        An AI agent tries to spend money. PolicyPay decides.      "));
  console.log(chalk.bold.cyan("=========================================================="));
  console.log("");

  // Parse command line arguments for subset selection (e.g. ts-node src/run-all.ts 2 4)
  const args = process.argv.slice(2);
  let scenariosToRun = ALL_SCENARIOS;

  if (args.length > 0) {
    const selectedIds = args
      .map((arg) => parseInt(arg, 10))
      .filter((num) => !isNaN(num) && num >= 1 && num <= 5);

    if (selectedIds.length > 0) {
      scenariosToRun = ALL_SCENARIOS.filter((s) => selectedIds.includes(s.id));
      console.log(
        chalk.yellow(
          `Running subset of scenarios: ${scenariosToRun.map((s) => s.id).join(", ")}\n`
        )
      );
    }
  }

  const results: Array<{ id: number; title: string; decision: string; ok: boolean }> = [];

  for (let i = 0; i < scenariosToRun.length; i++) {
    const scenario = scenariosToRun[i];
    const ok = await scenario.runFn();

    results.push({
      id: scenario.id,
      title: scenario.title,
      decision: scenario.expectedDecision,
      ok,
    });

    if (i < scenariosToRun.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      console.log("\n" + chalk.dim("-".repeat(74)) + "\n");
    }
  }

  // Print Summary Table
  console.log("\n" + chalk.bold.cyan("=========================================================="));
  console.log(chalk.bold.white("SUMMARY\n"));

  for (const r of results) {
    const symbol = r.ok ? chalk.bold.green("ok") : chalk.bold.red("fail");
    const idStr = r.id.toString().padEnd(2);
    const titleStr = r.title.padEnd(32);
    const decisionStr = r.decision.padEnd(10);

    console.log(`${idStr} ${titleStr} ${chalk.yellow(decisionStr)} ${symbol}`);
  }

  console.log(chalk.bold.cyan("==========================================================\n"));

  const allPassed = results.every((r) => r.ok);
  process.exit(allPassed ? 0 : 1);
}

main().catch((err) => {
  console.error(chalk.red("Fatal error running demo scenarios:"), err);
  process.exit(1);
});
