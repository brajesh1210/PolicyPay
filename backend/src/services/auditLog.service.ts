import crypto from "crypto";
import { TransactionDecision } from "@prisma/client";
import { prisma } from "../config/database";

export interface TransactionSummaryInput {
  id: string;
  agentId: string;
  merchantDomain: string;
  amountUsd: number;
  decision: TransactionDecision | string;
  riskScore: number;
  createdAt: Date;
}

export class AuditLogService {
  async writeAuditLog(transaction: TransactionSummaryInput) {
    const summary = {
      transactionId: transaction.id,
      agentId: transaction.agentId,
      merchantDomain: transaction.merchantDomain,
      amountUsd: transaction.amountUsd,
      decision: transaction.decision,
      riskScore: transaction.riskScore,
      createdAt: transaction.createdAt,
    };

    const payloadHash = crypto.createHash("sha256").update(JSON.stringify(summary)).digest("hex");

    const lastLog = await prisma.auditLog.findFirst({
      orderBy: { createdAt: "desc" },
    });

    const prevHash = lastLog ? lastLog.payloadHash : null;

    return prisma.auditLog.create({
      data: {
        transactionId: transaction.id,
        payloadHash,
        prevHash,
      },
    });
  }

  async list(page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          transaction: {
            select: {
              merchantDomain: true,
              amountUsd: true,
              agent: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      }),
      prisma.auditLog.count(),
    ]);

    return {
      logs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}

export const auditLogService = new AuditLogService();
