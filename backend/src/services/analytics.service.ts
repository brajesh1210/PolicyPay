import { TransactionDecision, ApprovalStatus, AgentStatus } from "@prisma/client";
import { prisma } from "../config/database";
import { approvalsService } from "./approvals.service";

function formatDateYyyyMmDd(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export class AnalyticsService {
  async getOverview(userId: string) {
    await approvalsService.expireStale();

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const yesterdayStart = new Date(todayStart.getTime() - 86400000);
    const yesterdayEnd = new Date(todayStart.getTime() - 1);

    const [
      todaySpendSum,
      yesterdaySpendSum,
      blockedTodayCount,
      pendingApprovalsCount,
      activeAgentsCount,
    ] = await Promise.all([
      prisma.transaction.aggregate({
        where: {
          agent: { userId },
          decision: TransactionDecision.ALLOW,
          createdAt: { gte: todayStart, lte: todayEnd },
        },
        _sum: { amountUsd: true },
      }),
      prisma.transaction.aggregate({
        where: {
          agent: { userId },
          decision: TransactionDecision.ALLOW,
          createdAt: { gte: yesterdayStart, lte: yesterdayEnd },
        },
        _sum: { amountUsd: true },
      }),
      prisma.transaction.count({
        where: {
          agent: { userId },
          decision: TransactionDecision.DENY,
          createdAt: { gte: todayStart, lte: todayEnd },
        },
      }),
      prisma.approval.count({
        where: {
          agent: { userId },
          status: ApprovalStatus.PENDING,
        },
      }),
      prisma.agent.count({
        where: {
          userId,
          status: AgentStatus.ACTIVE,
        },
      }),
    ]);

    const total_spend_today = todaySpendSum._sum.amountUsd || 0;
    const total_spend_yesterday = yesterdaySpendSum._sum.amountUsd || 0;

    let total_spend_today_change_pct = 0;
    if (total_spend_yesterday > 0) {
      const diff = total_spend_today - total_spend_yesterday;
      total_spend_today_change_pct = Number(((diff / total_spend_yesterday) * 100).toFixed(2));
    }

    return {
      total_spend_today,
      total_spend_today_change_pct,
      blocked_today: blockedTodayCount,
      pending_approvals: pendingApprovalsCount,
      active_agents: activeAgentsCount,
    };
  }

  async getSpendingTrends(userId: string, days: number = 7) {
    const safeDays = Math.max(1, Math.min(30, days));
    const now = new Date();

    const datesList: string[] = [];
    const dateMap = new Map<string, { amount: number; count: number }>();

    for (let i = safeDays - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const dateStr = formatDateYyyyMmDd(d);
      datesList.push(dateStr);
      dateMap.set(dateStr, { amount: 0, count: 0 });
    }

    const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (safeDays - 1), 0, 0, 0, 0);

    const transactions = await prisma.transaction.findMany({
      where: {
          agent: { userId },
        createdAt: { gte: startDate },
      },
      select: {
        decision: true,
        amountUsd: true,
        createdAt: true,
      },
    });

    for (const tx of transactions) {
      const txDateStr = formatDateYyyyMmDd(tx.createdAt);
      const entry = dateMap.get(txDateStr);
      if (entry) {
        entry.count += 1;
        if (tx.decision === TransactionDecision.ALLOW) {
          entry.amount += tx.amountUsd;
        }
      }
    }

    const trends = datesList.map((date) => {
      const data = dateMap.get(date) || { amount: 0, count: 0 };
      return {
        date,
        amount: Number(data.amount.toFixed(2)),
        count: data.count,
      };
    });

    return { trends };
  }

  async getStatusDistribution(userId: string) {
    const [allowCount, denyCount, requireApprovalCount, totalCount] = await Promise.all([
      prisma.transaction.count({ where: { agent: { userId }, decision: TransactionDecision.ALLOW } }),
      prisma.transaction.count({ where: { agent: { userId }, decision: TransactionDecision.DENY } }),
      prisma.transaction.count({ where: { agent: { userId }, decision: TransactionDecision.REQUIRE_APPROVAL } }),
      prisma.transaction.count({ where: { agent: { userId } } }),
    ]);

    return {
      allow: allowCount,
      deny: denyCount,
      require_approval: requireApprovalCount,
      total: totalCount,
    };
  }

  async getRecentTransactions(userId: string, limit: number = 5) {
    const safeLimit = Math.max(1, Math.min(50, limit));

    const transactions = await prisma.transaction.findMany({
      orderBy: { createdAt: "desc" },
      take: safeLimit,
      include: {
        agent: {
          select: {
            name: true,
          },
        },
      },
    });

    return {
      transactions: transactions.map((tx) => ({
        id: tx.id,
        agentName: tx.agent.name,
        merchantDomain: tx.merchantDomain,
        amountUsd: tx.amountUsd,
        decision: tx.decision,
        riskScore: tx.riskScore,
        createdAt: tx.createdAt,
      })),
    };
  }
}

export const analyticsService = new AnalyticsService();
