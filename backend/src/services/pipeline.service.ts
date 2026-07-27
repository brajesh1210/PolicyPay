import { Agent, Policy, ApprovalStatus } from "@prisma/client";
import { AuthorizePaymentRequest, AuthorizePaymentResponseData, X402Payment } from "@policypay/contracts";
import { prisma } from "../config/database";
import { env } from "../config/env";
import { policyEngineService, EvaluatePolicyOptions } from "./policyEngine.service";
import { promptIntentGuardService } from "./promptIntentGuard.service";
import { calculateRisk } from "./riskEngine.service";
import { decisionEngineService } from "./decisionEngine.service";
import { auditLogService } from "./auditLog.service";
import { budgetEngineService } from "./budgetEngine.service";
import { frequencyEngineService } from "./frequencyEngine.service";
import { alertsService } from "./alerts.service";
import { walletSignerService } from "./walletSigner.service";

export interface PipelineInput {
  body: AuthorizePaymentRequest;
  agent: Agent & { policy: Policy };
}

export interface PipelineOptions extends EvaluatePolicyOptions {
  dryRun: boolean;
}

export interface PipelineResult extends AuthorizePaymentResponseData {
  simulated?: boolean;
}

export class PipelineService {
  async evaluate(input: PipelineInput, options: PipelineOptions): Promise<PipelineResult> {
    const { body, agent } = input;
    const { dryRun, overridePolicy } = options;
    const activePolicy = overridePolicy || agent.policy;

    // 1. Policy evaluation (steps 2-14)
    const policyResult = await policyEngineService.evaluatePolicy(agent, body, {
      dryRun,
      overridePolicy,
    });

    // 2. Step 15: Prompt intent check
    const promptResult = promptIntentGuardService.check(body.purpose);

    // 3. Step 16: Risk calculation
    const riskResult = await calculateRisk({
      agentId: agent.id,
      policy: activePolicy,
      amountUsd: body.amount_usd,
      merchantReputation: policyResult.merchant.reputation,
      injectionFlagged: promptResult.flagged,
      now: new Date(),
    });

    // 4. Step 17: Decision engine
    const decisionResult = decisionEngineService.makeDecision(
      policyResult.failed,
      policyResult.reasonCode,
      riskResult.score,
      activePolicy
    );

    // Assemble reason codes list
    const reasonCodes: string[] = [];
    if (policyResult.failed && policyResult.reasonCode) {
      reasonCodes.push(policyResult.reasonCode);
    } else {
      reasonCodes.push(decisionResult.primaryReasonCode);
    }

    for (const code of riskResult.reasonCodes) {
      if (!reasonCodes.includes(code)) {
        reasonCodes.push(code);
      }
    }

    // 5. If dryRun is true, return simulated result without database mutations or side-effects
    if (dryRun) {
      return {
        transaction_id: "tx_simulated_" + Date.now(),
        decision: decisionResult.decision,
        risk_score: riskResult.score,
        reason_codes: reasonCodes,
        policy_checks: policyResult.checks,
        risk_breakdown: riskResult.breakdown,
        simulated: true,
      };
    }

    // 6. Non-dry-run: Save Transaction in DB
    const transaction = await prisma.transaction.create({
      data: {
        agentId: agent.id,
        merchantDomain: body.merchant.domain,
        merchantName: policyResult.merchant.name || body.merchant.name,
        amountUsd: body.amount_usd,
        currency: body.currency,
        purpose: body.purpose || null,
        idempotencyKey: body.idempotency_key,
        decision: decisionResult.decision,
        riskScore: riskResult.score,
        reasonCodes: reasonCodes as any,
        policyChecks: policyResult.checks as any,
        riskBreakdown: riskResult.breakdown as any,
      },
    });

    // 7. Write Audit Log
    await auditLogService.writeAuditLog(transaction);

    // 8. Process decision side-effects
    let x402_payment: X402Payment | undefined = undefined;
    let approval_id: string | undefined = undefined;

    if (decisionResult.decision === "ALLOW") {
      await budgetEngineService.addSpend(agent.id, body.amount_usd);
      await frequencyEngineService.increment(agent.id);
      await frequencyEngineService.recordBurst(agent.id);

      await prisma.agent.update({
        where: { id: agent.id },
        data: {
          totalSpent: { increment: body.amount_usd },
          totalTx: { increment: 1 },
          lastActiveAt: new Date(),
        },
      });

      const newDailySpend = policyResult.dailySpend + body.amount_usd;
      if (newDailySpend >= activePolicy.dailyBudgetUsd * 0.9) {
        await alertsService.onBudgetThreshold(
          agent.id,
          newDailySpend,
          activePolicy.dailyBudgetUsd
        );
      }

      x402_payment = walletSignerService.signX402();
    } else if (decisionResult.decision === "DENY") {
      await alertsService.onTransactionBlocked(
        agent.id,
        body.merchant.domain,
        body.amount_usd,
        reasonCodes[0]
      );

      if (promptResult.flagged && promptResult.matched) {
        await alertsService.onPromptInjection(agent.id, promptResult.matched);
      }
    } else if (decisionResult.decision === "REQUIRE_APPROVAL") {
      const expiryMs = env.APPROVAL_EXPIRY_MINUTES * 60 * 1000;
      const approval = await prisma.approval.create({
        data: {
          transactionId: transaction.id,
          agentId: agent.id,
          status: ApprovalStatus.PENDING,
          reason: reasonCodes[0] || "REQUIRE_APPROVAL",
          expiresAt: new Date(Date.now() + expiryMs),
        },
      });
      approval_id = approval.id;
    }

    return {
      transaction_id: transaction.id,
      decision: decisionResult.decision,
      risk_score: riskResult.score,
      reason_codes: reasonCodes,
      policy_checks: policyResult.checks,
      risk_breakdown: riskResult.breakdown,
      ...(x402_payment && { x402_payment }),
      ...(approval_id && { approval_id }),
    };
  }
}

export const pipelineService = new PipelineService();
