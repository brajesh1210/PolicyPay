import axios from "axios";
import chalk from "chalk";
import dotenv from "dotenv";
import { randomUUID } from "node:crypto";

dotenv.config();

async function checkSetup() {
  console.log(chalk.bold.cyan("\n🔍 PolicyPay Pre-Demo Setup Check\n"));

  let allPassed = true;

  // --------------------------------------------------------------------------
  // 1) Check .env values
  // --------------------------------------------------------------------------
  const agentAId = process.env.AGENT_A_ID;
  const agentAKey = process.env.AGENT_A_KEY;
  const agentBId = process.env.AGENT_B_ID;
  const agentBKey = process.env.AGENT_B_KEY;

  if (agentAId && agentAKey && agentBId && agentBKey) {
    console.log(chalk.green("✔ 1. Environment variables (.env) are configured"));
  } else {
    allPassed = false;
    console.log(
      chalk.red("✖ 1. Missing agent credentials in demo-agent/.env") +
        "\n   " +
        chalk.yellow("Ask Brajesh for the seed output")
    );
  }

  // --------------------------------------------------------------------------
  // 2) Check Backend health
  // --------------------------------------------------------------------------
  const baseUrl = process.env.POLICYPAY_API_URL || "http://localhost:8080";
  let backendUp = false;

  try {
    const res = await axios.get(`${baseUrl}/health`, {
      timeout: 3000,
      validateStatus: () => true,
    });
    if (res.status === 200) {
      backendUp = true;
      console.log(chalk.green(`✔ 2. Backend is running at ${baseUrl}`));
    } else {
      allPassed = false;
      console.log(
        chalk.red(`✖ 2. Backend returned HTTP ${res.status}`) +
          "\n   " +
          chalk.yellow("Backend is not running. Ask Brajesh to run npm run dev in backend/")
      );
    }
  } catch (_err) {
    allPassed = false;
    console.log(
      chalk.red(`✖ 2. Cannot connect to backend at ${baseUrl}`) +
        "\n   " +
        chalk.yellow("Backend is not running. Ask Brajesh to run npm run dev in backend/")
    );
  }

  // --------------------------------------------------------------------------
  // 3) Check Merchant Servers
  // --------------------------------------------------------------------------
  const ports = [3001, 3002, 3003];
  let merchantsUp = true;

  for (const port of ports) {
    try {
      const res = await axios.get(`http://localhost:${port}/paid-resource`, {
        timeout: 3000,
        validateStatus: () => true,
      });
      if (res.status !== 402) {
        merchantsUp = false;
      }
    } catch (_err) {
      merchantsUp = false;
    }
  }

  if (merchantsUp) {
    console.log(chalk.green("✔ 3. All merchant servers (3001, 3002, 3003) respond with HTTP 402"));
  } else {
    allPassed = false;
    console.log(
      chalk.red("✖ 3. Merchant servers are not responding properly") +
        "\n   " +
        chalk.yellow("Run npm run merchants in another terminal")
    );
  }

  // --------------------------------------------------------------------------
  // 4 & 5) Check Agent A Key & Global Kill Switch
  // --------------------------------------------------------------------------
  if (backendUp && agentAId && agentAKey) {
    try {
      const res = await axios.post(
        `${baseUrl}/v1/authorize-payment`,
        {
          agent_id: agentAId,
          merchant: {
            domain: "trusted-api.com",
            name: "Trusted API",
          },
          amount_usd: 0.01,
          currency: "USDC",
          purpose: "setup check",
          idempotency_key: randomUUID(),
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${agentAKey}`,
          },
          validateStatus: () => true,
        }
      );

      if (res.status === 200 && res.data?.success === true) {
        console.log(chalk.green("✔ 4. Agent A's API key is valid"));

        const reasonCodes: string[] = res.data?.data?.reason_codes || [];
        if (reasonCodes.includes("KILL_SWITCH_ACTIVE")) {
          allPassed = false;
          console.log(
            chalk.red("✖ 5. Global kill switch check failed") +
              "\n   " +
              chalk.bold.red(
                "The global kill switch is ON. Turn it off in Settings before the demo, otherwise every scenario will be denied."
              )
          );
        } else {
          console.log(chalk.green("✔ 5. Global kill switch is OFF"));
        }
      } else if (res.status === 401) {
        allPassed = false;
        console.log(
          chalk.red("✖ 4. Agent A's API key authentication failed") +
            "\n   " +
            chalk.yellow(
              "Agent A's API key is wrong, or the seed was re-run and the keys changed"
            )
        );
      } else {
        allPassed = false;
        console.log(
          chalk.red(`✖ 4. Authorization request returned HTTP ${res.status}`) +
            "\n   " +
            chalk.yellow(res.data?.error?.message || "Unexpected response")
        );
      }
    } catch (_err) {
      allPassed = false;
      console.log(
        chalk.red("✖ 4. Could not perform authorization check with Agent A key")
      );
    }
  } else {
    allPassed = false;
    console.log(
      chalk.red("✖ 4. Skipped Agent A key check because Backend or Credentials are missing")
    );
  }

  console.log("");
  if (allPassed) {
    console.log(chalk.bold.green("Ready for the demo\n"));
    process.exit(0);
  } else {
    console.log(chalk.bold.red("Fix the items above before demoing\n"));
    process.exit(1);
  }
}

checkSetup();
