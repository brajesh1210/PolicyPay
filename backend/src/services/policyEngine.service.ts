import { Agent, Policy, MerchantReputation } from "@prisma/client";
import { AuthorizePaymentRequest, PolicyCheck, REASON_CODES } from "@policypay/contracts";
import { prisma } from "../config/database";
import { globalConfigService } from "./globalConfig.service";
import { duplicateGuardService } from "./duplicateGuard.service";
import { budgetEngineService } from "./budgetEngine.service";
import { frequencyEngineService } from "./frequencyEngine.service";

export interface PolicyEvaluationResult {
  failed: boolean;
  reasonCode?: string;
  checks: PolicyCheck[];
  merchant: {
    domain: string;
    name?: string;
    category?: string;
    reputation: MerchantReputation | "TRUSTED" | "UNKNOWN" | "BLOCKED";
  };
  dailySpend: number;
  monthlySpend: number;
}

export class PolicyEngineService {
  async evaluatePolicy(
    agent: Agent & { policy: Policy },
    body: AuthorizePaymentRequest
  ): Promise<PolicyEvaluationResult> {
    const checks: PolicyCheck[] = [];

    // Fetch current spend and frequency metrics
    const dailySpend = await budgetEngineService.getDailySpend(agent.id);
    const monthlySpend = await budgetEngineService.getMonthlySpend(agent.id);
    const hourCount = await frequencyEngineService.getHourCount(agent.id);
    const dayCount = await frequencyEngineService.getDayCount(agent.id);

    // Lookup merchant by domain
    const merchantRow = await prisma.merchant.findUnique({
      where: { domain: body.merchant.domain },
    });

    const merchantInfo = {
      domain: body.merchant.domain,
      name: merchantRow?.name || body.merchant.name,
      category: merchantRow?.category,
      reputation: merchantRow ? merchantRow.reputation : MerchantReputation.UNKNOWN,
    };

    // ------------------------------------------------------------------------
    // Step 2: Global Kill Switch
    // ------------------------------------------------------------------------
    const globalConfig = await globalConfigService.getConfig();
    if (globalConfig.killSwitchActive) {
      checks.push({
        check: "global_kill_switch",
        passed: false,
        detail: "Global kill switch is active",
      });
      return {
        failed: true,
        reasonCode: REASON_CODES.KILL_SWITCH_ACTIVE,
        checks,
        merchant: merchantInfo,
        dailySpend,
        monthlySpend,
      };
    }
    checks.push({
      check: "global_kill_switch",
      passed: true,
      detail: "Global kill switch inactive",
    });

    // ------------------------------------------------------------------------
    // Step 3: Agent Kill Switch
    // ------------------------------------------------------------------------
    if (agent.killSwitchActive) {
      checks.push({
        check: "agent_kill_switch",
        passed: false,
        detail: "Agent kill switch is active",
      });
      return {
        failed: true,
        reasonCode: REASON_CODES.AGENT_KILL_SWITCH_ACTIVE,
        checks,
        merchant: merchantInfo,
        dailySpend,
        monthlySpend,
      };
    }
    checks.push({
      check: "agent_kill_switch",
      passed: true,
      detail: "Agent kill switch inactive",
    });

    // ------------------------------------------------------------------------
    // Step 4: Agent Status
    // ------------------------------------------------------------------------
    if (agent.status !== "ACTIVE") {
      checks.push({
        check: "agent_status",
        passed: false,
        detail: `Agent status is ${agent.status}`,
      });
      return {
        failed: true,
        reasonCode: REASON_CODES.AGENT_INACTIVE,
        checks,
        merchant: merchantInfo,
        dailySpend,
        monthlySpend,
      };
    }
    checks.push({
      check: "agent_status",
      passed: true,
      detail: "Agent status is ACTIVE",
    });

    // ------------------------------------------------------------------------
    // Step 5: Policy Enabled
    // ------------------------------------------------------------------------
    if (!agent.policy.enabled) {
      checks.push({
        check: "policy_enabled",
        passed: false,
        detail: "Policy is disabled",
      });
      return {
        failed: true,
        reasonCode: REASON_CODES.POLICY_DISABLED,
        checks,
        merchant: merchantInfo,
        dailySpend,
        monthlySpend,
      };
    }
    checks.push({
      check: "policy_enabled",
      passed: true,
      detail: "Policy is enabled",
    });

    // ------------------------------------------------------------------------
    // Step 6: Duplicate Guard
    // ------------------------------------------------------------------------
    const intentHash = duplicateGuardService.buildHash(
      agent.id,
      body.merchant.domain,
      body.amount_usd,
      body.idempotency_key
    );
    const reserved = await duplicateGuardService.checkAndReserve(intentHash);
    if (!reserved) {
      checks.push({
        check: "duplicate_guard",
        passed: false,
        detail: "Duplicate transaction intent detected",
      });
      return {
        failed: true,
        reasonCode: REASON_CODES.DUPLICATE_INTENT,
        checks,
        merchant: merchantInfo,
        dailySpend,
        monthlySpend,
      };
    }
    checks.push({
      check: "duplicate_guard",
      passed: true,
      detail: "Idempotency key and intent reserved successfully",
    });

    // ------------------------------------------------------------------------
    // Step 7: Merchant Reputation Check
    // ------------------------------------------------------------------------
    if (merchantInfo.reputation === MerchantReputation.BLOCKED) {
      checks.push({
        check: "merchant_reputation",
        passed: false,
        detail: `Merchant ${body.merchant.domain} is BLOCKED`,
      });
      return {
        failed: true,
        reasonCode: REASON_CODES.MERCHANT_BLOCKED,
        checks,
        merchant: merchantInfo,
        dailySpend,
        monthlySpend,
      };
    }
    checks.push({
      check: "merchant_reputation",
      passed: true,
      detail: `Merchant reputation: ${merchantInfo.reputation}`,
    });

    // ------------------------------------------------------------------------
    // Step 8: Unknown Merchant Check
    // ------------------------------------------------------------------------
    if (merchantInfo.reputation === MerchantReputation.UNKNOWN && agent.policy.blockUnknownMerchants) {
      checks.push({
        check: "unknown_merchant_allowed",
        passed: false,
        detail: "Unknown merchants are blocked by policy",
      });
      return {
        failed: true,
        reasonCode: REASON_CODES.MERCHANT_NOT_ALLOWED,
        checks,
        merchant: merchantInfo,
        dailySpend,
        monthlySpend,
      };
    }
    checks.push({
      check: "unknown_merchant_allowed",
      passed: true,
      detail: "Unknown merchant check passed",
    });

    // ------------------------------------------------------------------------
    // Step 9: Category Rules
    // ------------------------------------------------------------------------
    const blockedCategories = (agent.policy.blockedCategories as string[] | null) || [];
    const allowedCategories = (agent.policy.allowedCategories as string[] | null) || [];
    const category = merchantInfo.category || "";

    if (category && blockedCategories.includes(category)) {
      checks.push({
        check: "category_rules",
        passed: false,
        detail: `Category ${category} is blocked`,
      });
      return {
        failed: true,
        reasonCode: REASON_CODES.CATEGORY_BLOCKED,
        checks,
        merchant: merchantInfo,
        dailySpend,
        monthlySpend,
      };
    }

    if (allowedCategories.length > 0 && (!category || !allowedCategories.includes(category))) {
      checks.push({
        check: "category_rules",
        passed: false,
        detail: `Category ${category || "unspecified"} is not in allowed categories`,
      });
      return {
        failed: true,
        reasonCode: REASON_CODES.CATEGORY_BLOCKED,
        checks,
        merchant: merchantInfo,
        dailySpend,
        monthlySpend,
      };
    }

    checks.push({
      check: "category_rules",
      passed: true,
      detail: "Category rules passed",
    });

    // ------------------------------------------------------------------------
    // Step 10: Per-Transaction Limit
    // ------------------------------------------------------------------------
    if (body.amount_usd > agent.policy.perTxLimitUsd) {
      checks.push({
        check: "per_transaction_limit",
        passed: false,
        detail: `Amount $${body.amount_usd} exceeds per-transaction limit of $${agent.policy.perTxLimitUsd}`,
      });
      return {
        failed: true,
        reasonCode: REASON_CODES.PER_TX_LIMIT_EXCEEDED,
        checks,
        merchant: merchantInfo,
        dailySpend,
        monthlySpend,
      };
    }
    checks.push({
      check: "per_transaction_limit",
      passed: true,
      detail: "Per-transaction limit check passed",
    });

    // ------------------------------------------------------------------------
    // Step 11: Daily Budget
    // ------------------------------------------------------------------------
    if (dailySpend + body.amount_usd > agent.policy.dailyBudgetUsd) {
      checks.push({
        check: "daily_budget",
        passed: false,
        detail: `Projected daily spend $${(dailySpend + body.amount_usd).toFixed(2)} exceeds daily budget $${agent.policy.dailyBudgetUsd}`,
      });
      return {
        failed: true,
        reasonCode: REASON_CODES.DAILY_BUDGET_EXCEEDED,
        checks,
        merchant: merchantInfo,
        dailySpend,
        monthlySpend,
      };
    }
    checks.push({
      check: "daily_budget",
      passed: true,
      detail: "Daily budget check passed",
    });

    // ------------------------------------------------------------------------
    // Step 12: Monthly Budget
    // ------------------------------------------------------------------------
    if (monthlySpend + body.amount_usd > agent.policy.monthlyBudgetUsd) {
      checks.push({
        check: "monthly_budget",
        passed: false,
        detail: `Projected monthly spend $${(monthlySpend + body.amount_usd).toFixed(2)} exceeds monthly budget $${agent.policy.monthlyBudgetUsd}`,
      });
      return {
        failed: true,
        reasonCode: REASON_CODES.MONTHLY_BUDGET_EXCEEDED,
        checks,
        merchant: merchantInfo,
        dailySpend,
        monthlySpend,
      };
    }
    checks.push({
      check: "monthly_budget",
      passed: true,
      detail: "Monthly budget check passed",
    });

    // ------------------------------------------------------------------------
    // Step 13: Hourly Frequency Limit
    // ------------------------------------------------------------------------
    if (hourCount >= agent.policy.maxTxPerHour) {
      checks.push({
        check: "hourly_frequency",
        passed: false,
        detail: `Hourly count (${hourCount}) reached max limit (${agent.policy.maxTxPerHour})`,
      });
      return {
        failed: true,
        reasonCode: REASON_CODES.HOURLY_FREQUENCY_EXCEEDED,
        checks,
        merchant: merchantInfo,
        dailySpend,
        monthlySpend,
      };
    }
    checks.push({
      check: "hourly_frequency",
      passed: true,
      detail: "Hourly frequency check passed",
    });

    // ------------------------------------------------------------------------
    // Step 14: Daily Frequency Limit
    // ------------------------------------------------------------------------
    if (dayCount >= agent.policy.maxTxPerDay) {
      checks.push({
        check: "daily_frequency",
        passed: false,
        detail: `Daily count (${dayCount}) reached max limit (${agent.policy.maxTxPerDay})`,
      });
      return {
        failed: true,
        reasonCode: REASON_CODES.DAILY_FREQUENCY_EXCEEDED,
        checks,
        merchant: merchantInfo,
        dailySpend,
        monthlySpend,
      };
    }
    checks.push({
      check: "daily_frequency",
      passed: true,
      detail: "Daily frequency check passed",
    });

    return {
      failed: false,
      checks,
      merchant: merchantInfo,
      dailySpend,
      monthlySpend,
    };
  }
}

export const policyEngineService = new PolicyEngineService();
