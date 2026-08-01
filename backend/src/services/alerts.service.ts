import { AlertType, AlertSeverity, Alert, Prisma } from "@prisma/client";
import { prisma } from "../config/database";
import { NotFoundError } from "../utils/errors";

export interface AlertFilterOptions {
  is_dismissed?: boolean;
  severity?: AlertSeverity;
}

export class AlertsService {
  async createAlert(
    type: AlertType,
    severity: AlertSeverity,
    title: string,
    description: string,
    agentId?: string
  ): Promise<Alert> {
    return prisma.alert.create({
      data: {
        type,
        severity,
        title,
        description,
        agentId: agentId || null,
        isRead: false,
        isDismissed: false,
      },
    });
  }

  async onTransactionBlocked(
    agentId: string,
    merchantDomain: string,
    amountUsd: number,
    reason?: string
  ): Promise<Alert> {
    const title = "Transaction Blocked";
    const description = `Transaction of $${amountUsd} to ${merchantDomain} was blocked${
      reason ? `: ${reason}` : ""
    }`;
    return this.createAlert(
      AlertType.TRANSACTION_BLOCKED,
      AlertSeverity.HIGH,
      title,
      description,
      agentId
    );
  }

  async onBudgetThreshold(
    agentId: string,
    dailySpend: number,
    dailyBudget: number
  ): Promise<Alert> {
    const percentage = dailyBudget > 0 ? ((dailySpend / dailyBudget) * 100).toFixed(0) : "100";
    const title = "Daily Budget Threshold Reached";
    const description = `Daily spend ($${dailySpend.toFixed(
      2
    )}) reached ${percentage}% of daily budget ($${dailyBudget})`;
    return this.createAlert(
      AlertType.BUDGET_THRESHOLD,
      AlertSeverity.MEDIUM,
      title,
      description,
      agentId
    );
  }

  async onPromptInjection(agentId: string, matchedPhrase: string): Promise<Alert> {
    const title = "Prompt Injection Detected";
    const description = `Suspected prompt injection phrase matched: "${matchedPhrase}"`;
    return this.createAlert(
      AlertType.PROMPT_INJECTION_DETECTED,
      AlertSeverity.HIGH,
      title,
      description,
      agentId
    );
  }

  async onUnknownMerchant(agentId: string, merchantDomain: string): Promise<Alert> {
    const title = "Unknown Merchant Detected";
    const description = `Transaction attempted with unknown merchant: ${merchantDomain}`;
    return this.createAlert(
      AlertType.UNKNOWN_MERCHANT,
      AlertSeverity.MEDIUM,
      title,
      description,
      agentId
    );
  }

  async onKillSwitch(agentId?: string): Promise<Alert> {
    const title = "Kill Switch Activated";
    const description = agentId
      ? `Kill switch activated for agent ID ${agentId}`
      : "Global kill switch activated";
    return this.createAlert(
      AlertType.KILL_SWITCH_ACTIVATED,
      AlertSeverity.HIGH,
      title,
      description,
      agentId
    );
  }

  async onSuspiciousBurst(agentId: string, count: number): Promise<Alert> {
    const title = "Suspicious Burst Detected";
    const description = `${count} transactions attempted within 10 minutes`;
    return this.createAlert(
      AlertType.SUSPICIOUS_BURST,
      AlertSeverity.MEDIUM,
      title,
      description,
      agentId
    );
  }

  async list(userId: string, filters: AlertFilterOptions): Promise<Alert[]> {
    const where: Prisma.AlertWhereInput = { agent: { userId } };

    if (filters.is_dismissed !== undefined) {
      where.isDismissed = filters.is_dismissed;
    }

    if (filters.severity !== undefined) {
      where.severity = filters.severity;
    }

    return prisma.alert.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });
  }

  async markRead(id: string): Promise<Alert> {
    const alert = await prisma.alert.findUnique({ where: { id } });
    if (!alert) {
      throw new NotFoundError("Alert not found");
    }

    return prisma.alert.update({
      where: { id },
      data: { isRead: true },
    });
  }

  async dismiss(id: string): Promise<Alert> {
    const alert = await prisma.alert.findUnique({ where: { id } });
    if (!alert) {
      throw new NotFoundError("Alert not found");
    }

    return prisma.alert.update({
      where: { id },
      data: { isDismissed: true },
    });
  }
}

export const alertsService = new AlertsService();
