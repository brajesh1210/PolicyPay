import { TransactionDecision, Prisma } from "@prisma/client";
import { prisma } from "../config/database";
import { NotFoundError } from "../utils/errors";

export interface TransactionFilterOptions {
  decision?: TransactionDecision;
  agentId?: string;
  merchant?: string;
  dateFrom?: Date;
  dateTo?: Date;
  page?: number;
  limit?: number;
}

export class TransactionsService {
  async list(userId: string, filters: TransactionFilterOptions) {
    const page = Math.max(1, filters.page || 1);
    const rawLimit = filters.limit || 20;
    const limit = Math.min(100, Math.max(1, rawLimit));
    const skip = (page - 1) * limit;

    const where: Prisma.TransactionWhereInput = { agent: { userId } };

    if (filters.decision) {
      where.decision = filters.decision;
    }

    if (filters.agentId) {
      where.agentId = filters.agentId;
    }

    if (filters.merchant) {
      where.OR = [
        { merchantDomain: { contains: filters.merchant, mode: "insensitive" } },
        { merchantName: { contains: filters.merchant, mode: "insensitive" } },
      ];
    }

    if (filters.dateFrom || filters.dateTo) {
      where.createdAt = {
        ...(filters.dateFrom && { gte: filters.dateFrom }),
        ...(filters.dateTo && { lte: filters.dateTo }),
      };
    }

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        include: {
          agent: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.transaction.count({ where }),
    ]);

    return {
      transactions,
      total,
      page,
      limit,
    };
  }

  async getById(id: string) {
    const transaction = await prisma.transaction.findUnique({
      where: { id },
      include: {
        agent: {
          select: {
            id: true,
            name: true,
          },
        },
        approval: true,
      },
    });

    if (!transaction) {
      throw new NotFoundError("Transaction not found");
    }

    return transaction;
  }
}

export const transactionsService = new TransactionsService();
