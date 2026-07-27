import { Policy } from "@prisma/client";
import { AuthorizePaymentRequest } from "@policypay/contracts";
import { prisma } from "../config/database";
import { NotFoundError } from "../utils/errors";
import { pipelineService } from "./pipeline.service";

export interface PolicyDraftInput {
  perTxLimitUsd: number;
  dailyBudgetUsd: number;
  monthlyBudgetUsd: number;
  maxTxPerHour: number;
  maxTxPerDay: number;
  approvalThresholdScore: number;
  denyThresholdScore: number;
  allowedHoursStart?: string | null;
  allowedHoursEnd?: string | null;
  blockUnknownMerchants?: boolean;
  allowedCategories?: string[] | null;
  blockedCategories?: string[] | null;
}

export class SimulationService {
  async simulate(body: AuthorizePaymentRequest) {
    const agent = await prisma.agent.findUnique({
      where: { id: body.agent_id },
      include: { policy: true },
    });

    if (!agent) {
      throw new NotFoundError("Agent not found");
    }

    const result = await pipelineService.evaluate(
      { body, agent },
      { dryRun: true }
    );

    return {
      decision: result.decision,
      risk_score: result.risk_score,
      reason_codes: result.reason_codes,
      policy_checks: result.policy_checks,
      risk_breakdown: result.risk_breakdown,
      simulated: true,
    };
  }

  async replay(policyDraft: PolicyDraftInput, lastN: number = 20) {
    const safeN = Math.max(1, Math.min(200, lastN));

    const transactions = await prisma.transaction.findMany({
      orderBy: { createdAt: "desc" },
      take: safeN,
      include: {
        agent: {
          include: {
            policy: true,
          },
        },
      },
    });

    let would_allow = 0;
    let would_deny = 0;
    let would_require_approval = 0;
    let changed = 0;

    const reasonMap = new Map<string, number>();

    for (const tx of transactions) {
      const body: AuthorizePaymentRequest = {
        agent_id: tx.agentId,
        merchant: {
          domain: tx.merchantDomain,
          name: tx.merchantName || undefined,
        },
        amount_usd: tx.amountUsd,
        currency: tx.currency,
        purpose: tx.purpose || undefined,
        idempotency_key: tx.idempotencyKey,
      };

      const mergedPolicy: Policy = {
        ...tx.agent.policy,
        ...policyDraft,
        allowedHoursStart: policyDraft.allowedHoursStart ?? null,
        allowedHoursEnd: policyDraft.allowedHoursEnd ?? null,
        blockUnknownMerchants: policyDraft.blockUnknownMerchants ?? true,
        allowedCategories: policyDraft.allowedCategories
          ? (policyDraft.allowedCategories as any)
          : null,
        blockedCategories: policyDraft.blockedCategories
          ? (policyDraft.blockedCategories as any)
          : null,
      };

      const simResult = await pipelineService.evaluate(
        { body, agent: tx.agent },
        { dryRun: true, overridePolicy: mergedPolicy }
      );

      if (simResult.decision === "ALLOW") {
        would_allow += 1;
      } else if (simResult.decision === "DENY") {
        would_deny += 1;
      } else if (simResult.decision === "REQUIRE_APPROVAL") {
        would_require_approval += 1;
      }

      if (simResult.decision !== tx.decision) {
        changed += 1;
      }

      for (const code of simResult.reason_codes) {
        const currentCount = reasonMap.get(code) || 0;
        reasonMap.set(code, currentCount + 1);
      }
    }

    const top_reasons = Array.from(reasonMap.entries())
      .map(([code, count]) => ({ code, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      evaluated: transactions.length,
      would_allow,
      would_deny,
      would_require_approval,
      changed,
      top_reasons,
    };
  }
}

export const simulationService = new SimulationService();
