import { ApprovalStatus, TransactionDecision, Prisma } from "@prisma/client";
import { prisma } from "../config/database";
import { NotFoundError, ConflictError } from "../utils/errors";
import { budgetEngineService } from "./budgetEngine.service";
import { frequencyEngineService } from "./frequencyEngine.service";
import { walletSignerService } from "./walletSigner.service";

export class ApprovalsService {
  async expireStale(): Promise<number> {
    const result = await prisma.approval.updateMany({
      where: {
        status: ApprovalStatus.PENDING,
        expiresAt: {
          lt: new Date(),
        },
      },
      data: {
        status: ApprovalStatus.EXPIRED,
      },
    });
    return result.count;
  }

  async list(userId: string, status?: ApprovalStatus) {
    await this.expireStale();

    const where: Prisma.ApprovalWhereInput = { agent: { userId } };
    if (status) {
      where.status = status;
    }

    return prisma.approval.findMany({
      where,
      include: {
        agent: {
          select: {
            id: true,
            name: true,
          },
        },
        transaction: {
          select: {
            id: true,
            amountUsd: true,
            merchantDomain: true,
            purpose: true,
            riskScore: true,
            reasonCodes: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async approve(id: string, note?: string) {
    await this.expireStale();

    const approval = await prisma.approval.findUnique({
      where: { id },
      include: {
        transaction: true,
        agent: true,
      },
    });

    if (!approval) {
      throw new NotFoundError("Approval request not found");
    }

    if (approval.status !== ApprovalStatus.PENDING) {
      throw new ConflictError(
        `Approval request is no longer pending (current status: ${approval.status})`
      );
    }

    const x402Payment = walletSignerService.signX402();

    const updatedApproval = await prisma.approval.update({
      where: { id },
      data: {
        status: ApprovalStatus.APPROVED,
        decidedAt: new Date(),
        note: note || null,
      },
      include: {
        agent: {
          select: {
            id: true,
            name: true,
          },
        },
        transaction: true,
      },
    });

    // Update linked Transaction to ALLOW
    await prisma.transaction.update({
      where: { id: approval.transactionId },
      data: {
        decision: TransactionDecision.ALLOW,
        x402TxHash: x402Payment.signed_payload,
      },
    });

    // Apply spend and frequency side-effects
    await budgetEngineService.addSpend(approval.agentId, approval.transaction.amountUsd);
    await frequencyEngineService.increment(approval.agentId);
    await frequencyEngineService.recordBurst(approval.agentId);

    // Update agent totals
    await prisma.agent.update({
      where: { id: approval.agentId },
      data: {
        totalSpent: { increment: approval.transaction.amountUsd },
        totalTx: { increment: 1 },
        lastActiveAt: new Date(),
      },
    });

    return {
      approval: updatedApproval,
      x402_payment: x402Payment,
    };
  }

  async reject(id: string, note?: string) {
    await this.expireStale();

    const approval = await prisma.approval.findUnique({
      where: { id },
      include: {
        transaction: true,
      },
    });

    if (!approval) {
      throw new NotFoundError("Approval request not found");
    }

    if (approval.status !== ApprovalStatus.PENDING) {
      throw new ConflictError(
        `Approval request is no longer pending (current status: ${approval.status})`
      );
    }

    const updatedApproval = await prisma.approval.update({
      where: { id },
      data: {
        status: ApprovalStatus.REJECTED,
        decidedAt: new Date(),
        note: note || null,
      },
      include: {
        agent: {
          select: {
            id: true,
            name: true,
          },
        },
        transaction: true,
      },
    });

    // Update linked Transaction to DENY
    await prisma.transaction.update({
      where: { id: approval.transactionId },
      data: {
        decision: TransactionDecision.DENY,
      },
    });

    return updatedApproval;
  }
}

export const approvalsService = new ApprovalsService();
