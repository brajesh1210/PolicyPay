import { Request, Response, NextFunction } from "express";
import { ApprovalStatus } from "@prisma/client";
import {
  authorizePaymentRequestSchema,
  AuthorizePaymentResponseData,
  X402Payment,
} from "@policypay/contracts";
import { prisma } from "../config/database";
import { env } from "../config/env";
import { ok } from "../utils/response";
import { ValidationError, ForbiddenError, NotFoundError } from "../utils/errors";
import { policyEngineService } from "../services/policyEngine.service";
import { promptIntentGuardService } from "../services/promptIntentGuard.service";
import { calculateRisk } from "../services/riskEngine.service";
import { decisionEngineService } from "../services/decisionEngine.service";
import { auditLogService } from "../services/auditLog.service";
import { budgetEngineService } from "../services/budgetEngine.service";
import { frequencyEngineService } from "../services/frequencyEngine.service";
import { alertsService } from "../services/alerts.service";
import { walletSignerService } from "../services/walletSigner.service";

export class AuthorizeController {
  async authorizePayment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // 1. Validate request body with zod
      const parsed = authorizePaymentRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError("Validation failed", parsed.error.format());
      }
      const body = parsed.data;

      // 2. Step 1: Agent authentication matching
      const authAgentId = req.agentAuth?.agentId;
      if (!authAgentId) {
        throw new ForbiddenError("Missing API key authentication");
      }

      if (body.agent_id !== authAgentId) {
        throw new ForbiddenError("Agent ID in request body does not match authenticated API key");
      }

      const agent = await prisma.agent.findUnique({
        where: { id: authAgentId },
        include: { policy: true },
      });

      if (!agent) {
        throw new NotFoundError("Authenticated agent not found");
      }

      // 3. Steps 2-14: Policy evaluation
      const policyResult = await policyEngineService.evaluatePolicy(agent, body);

      // 4. Step 15: Prompt intent check
      const promptResult = promptIntentGuardService.check(body.purpose);

      // 5. Step 16: Risk calculation
      const riskResult = await calculateRisk({
        agentId: agent.id,
        policy: agent.policy,
        amountUsd: body.amount_usd,
        merchantReputation: policyResult.merchant.reputation,
        injectionFlagged: promptResult.flagged,
        now: new Date(),
      });

      // 6. Step 17: Decision engine
      const decisionResult = decisionEngineService.makeDecision(
        policyResult.failed,
        policyResult.reasonCode,
        riskResult.score,
        agent.policy
      );

      // Assemble final reason codes list
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

      // 7. Store Transaction in DB
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

      // 8. Write Audit Log
      await auditLogService.writeAuditLog(transaction);

      // 9. Process Decision Side-effects & Prepare Response
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
        if (newDailySpend >= agent.policy.dailyBudgetUsd * 0.9) {
          await alertsService.onBudgetThreshold(
            agent.id,
            newDailySpend,
            agent.policy.dailyBudgetUsd
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

      const responseData: AuthorizePaymentResponseData = {
        transaction_id: transaction.id,
        decision: decisionResult.decision,
        risk_score: riskResult.score,
        reason_codes: reasonCodes,
        policy_checks: policyResult.checks,
        risk_breakdown: riskResult.breakdown,
        ...(x402_payment && { x402_payment }),
        ...(approval_id && { approval_id }),
      };

      ok(res, responseData);
    } catch (err) {
      next(err);
    }
  }
}

export const authorizeController = new AuthorizeController();
