import axios from "axios";
import chalk from "chalk";
import dotenv from "dotenv";
import { randomUUID } from "node:crypto";

dotenv.config();

// ----------------------------------------------------------------------------
// 1) Types
// ----------------------------------------------------------------------------

export type Decision = "ALLOW" | "DENY" | "REQUIRE_APPROVAL";

export interface PolicyCheck {
  check: string;
  passed: boolean;
  detail?: string;
}

export interface RiskFactor {
  factor: string;
  points: number;
  detail?: string;
}

export interface AuthorizeResult {
  transaction_id: string;
  decision: Decision;
  risk_score: number;
  reason_codes: string[];
  policy_checks: PolicyCheck[];
  risk_breakdown: RiskFactor[];
  x402_payment?: {
    signed_payload: string;
    network: string;
  };
  approval_id?: string;
}

// ----------------------------------------------------------------------------
// 2) Agent Configurations
// ----------------------------------------------------------------------------

export interface AgentConfig {
  id: string;
  key: string;
  label: string;
}

export function agentA(): AgentConfig {
  const id = process.env.AGENT_A_ID;
  const key = process.env.AGENT_A_KEY;

  if (!id || !key) {
    console.error(
      chalk.red(
        "\n❌ Error: AGENT_A_ID or AGENT_A_KEY is missing.\n" +
          "Please copy demo-agent/.env.example to demo-agent/.env and fill it with the values from Brajesh's seed output.\n"
      )
    );
    process.exit(1);
  }

  return {
    id,
    key,
    label: "research-bot-1",
  };
}

export function agentB(): AgentConfig {
  const id = process.env.AGENT_B_ID;
  const key = process.env.AGENT_B_KEY;

  if (!id || !key) {
    console.error(
      chalk.red(
        "\n❌ Error: AGENT_B_ID or AGENT_B_KEY is missing.\n" +
          "Please copy demo-agent/.env.example to demo-agent/.env and fill it with the values from Brajesh's seed output.\n"
      )
    );
    process.exit(1);
  }

  return {
    id,
    key,
    label: "highvalue-bot-1",
  };
}

// ----------------------------------------------------------------------------
// 3) Call Merchant
// ----------------------------------------------------------------------------

export interface MerchantResourceResponse {
  merchant: {
    domain: string;
    name: string;
  };
  amount_usd: number;
  currency: string;
}

export async function callMerchant(port: number): Promise<MerchantResourceResponse> {
  try {
    const url = `http://localhost:${port}/paid-resource`;
    const response = await axios.get(url, {
      validateStatus: () => true,
    });

    if (response.status !== 402) {
      console.error(
        chalk.red(
          `\n❌ Error: Unexpected HTTP status ${response.status} from merchant on port ${port}.\n` +
            `Please ensure merchant servers are running via:\n` +
            `  npm run merchants\n`
        )
      );
      process.exit(1);
    }

    return response.data;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(
      chalk.red(
        `\n❌ Error connecting to merchant server on port ${port}: ${msg}\n` +
          `Please ensure merchant servers are running via:\n` +
          `  npm run merchants\n`
      )
    );
    process.exit(1);
  }
}

// ----------------------------------------------------------------------------
// 4) Authorize Payment
// ----------------------------------------------------------------------------

export async function authorize(params: {
  agent: AgentConfig;
  merchantDomain: string;
  merchantName: string;
  amountUsd: number;
  purpose: string;
}): Promise<AuthorizeResult> {
  const baseUrl = process.env.POLICYPAY_API_URL || "http://localhost:8080";
  const url = `${baseUrl}/v1/authorize-payment`;

  const payload = {
    agent_id: params.agent.id,
    merchant: {
      domain: params.merchantDomain,
      name: params.merchantName,
    },
    amount_usd: params.amountUsd,
    currency: "USDC",
    purpose: params.purpose,
    idempotency_key: randomUUID(),
  };

  const response = await axios.post(url, payload, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${params.agent.key}`,
    },
    validateStatus: () => true,
  });

  if (response.status === 200 && response.data?.success === true) {
    return response.data.data as AuthorizeResult;
  }

  if (response.status === 401) {
    console.error(
      chalk.red(
        `\n❌ Error 401 Unauthorized: Invalid API key for agent ${params.agent.label}.\n` +
          `Please check that AGENT_A_KEY / AGENT_B_KEY in demo-agent/.env match the output of 'npm run seed'.\n`
      )
    );
    process.exit(1);
  }

  const errorMsg = response.data?.error?.message || `HTTP ${response.status} Authorization failure`;
  console.error(chalk.red(`\n❌ PolicyPay Authorization Error: ${errorMsg}\n`));
  process.exit(1);
}

// ----------------------------------------------------------------------------
// 5) Claim Resource
// ----------------------------------------------------------------------------

export async function claimResource(port: number, signedPayload: string): Promise<unknown> {
  const url = `http://localhost:${port}/paid-resource/claim`;
  const response = await axios.post(
    url,
    {
      signed_payload: signedPayload,
    },
    {
      headers: {
        "Content-Type": "application/json",
      },
      validateStatus: () => true,
    }
  );

  return response.data;
}
