import chalk from "chalk";
import { start, MerchantConfig } from "./merchant-server";

/**
 * Starts all mock merchant servers for PolicyPay demo scenarios.
 *
 * NOTE:
 * - HTTP 402 status code represents "Payment Required".
 * - These mock servers simulate pretend shops used solely for demonstration.
 */
const merchantConfigs: MerchantConfig[] = [
  {
    port: 3001,
    domain: "trusted-api.com",
    name: "Trusted API",
    priceUsd: 2.5,
  },
  {
    port: 3002,
    domain: "unknown-service.xyz",
    name: "Unknown Service",
    priceUsd: 5.0,
  },
  {
    port: 3003,
    domain: "shady-payments.com",
    name: "Shady Payments",
    priceUsd: 3.0,
  },
];

function main() {
  console.log(chalk.bold.cyan("\n🚀 Starting Demo Merchant Servers..."));
  console.log(
    chalk.yellow(
      "📌 HTTP 402 indicates 'Payment Required'. These are pretend shops used for testing PolicyPay flows.\n"
    )
  );

  for (const config of merchantConfigs) {
    start(config);
  }

  // Print formatted table using chalk
  console.log("\n" + chalk.bold.green("=== Active Demo Merchants ==="));
  console.log(chalk.gray("----------------------------------------------------------------------"));
  console.log(
    `${chalk.bold("Port").padEnd(14)} | ${chalk.bold("Domain").padEnd(24)} | ${chalk.bold("Merchant Name").padEnd(20)} | ${chalk.bold("Price (USD)")}`
  );
  console.log(chalk.gray("----------------------------------------------------------------------"));

  for (const config of merchantConfigs) {
    console.log(
      `${chalk.cyan(config.port.toString()).padEnd(14)} | ${chalk.white(config.domain).padEnd(24)} | ${chalk.magenta(config.name).padEnd(20)} | $${chalk.yellow(config.priceUsd.toFixed(2))}`
    );
  }
  console.log(chalk.gray("----------------------------------------------------------------------\n"));
  console.log(chalk.dim("Keeping merchant servers running... Press Ctrl+C to stop.\n"));
}

main();
