import { prisma } from "../config/database";
import { MerchantReputation, PolicyTemplate } from "@prisma/client";
import { POLICY_TEMPLATES } from "./policies.service";

/**
 * Everything a brand-new workspace needs to be usable immediately.
 *
 * Without this a new account lands on an empty dashboard with no way to
 * create an agent (agents need a policy, and they'd have none).
 */
export class WorkspaceService {
  async bootstrap(userId: string): Promise<void> {
    // 1. The three policy tiers, same shapes the product ships with.
    const [conservative] = await Promise.all(
      (["CONSERVATIVE", "MODERATE", "AGGRESSIVE"] as const).map((key) => {
        const t = POLICY_TEMPLATES[key];
        return prisma.policy.create({
          data: {
            userId,
            template: t.template as PolicyTemplate,
            name: t.name,
            perTxLimitUsd: t.perTxLimitUsd,
            dailyBudgetUsd: t.dailyBudgetUsd,
            monthlyBudgetUsd: t.monthlyBudgetUsd,
            maxTxPerHour: t.maxTxPerHour,
            maxTxPerDay: t.maxTxPerDay,
            approvalThresholdScore: t.approvalThresholdScore,
            denyThresholdScore: t.denyThresholdScore,
            allowedHoursStart: t.allowedHoursStart ?? null,
            allowedHoursEnd: t.allowedHoursEnd ?? null,
            blockUnknownMerchants: t.blockUnknownMerchants ?? true,
          },
        });
      })
    );

    // 2. A few vendors people actually pay, so the allowlist isn't empty.
    await prisma.merchant.createMany({
      data: [
        { userId, name: "OpenAI",      domain: "api.openai.com",    category: "ai",    reputation: MerchantReputation.TRUSTED },
        { userId, name: "Anthropic",   domain: "api.anthropic.com", category: "ai",    reputation: MerchantReputation.TRUSTED },
        { userId, name: "Trusted API", domain: "trusted-api.com",   category: "api",   reputation: MerchantReputation.TRUSTED },
      ],
      skipDuplicates: true,
    });

    // 3. One agent, on the safest tier, ready to be connected.
    await prisma.agent.create({
      data: {
        userId,
        name: "my-first-agent",
        description: "Created with your account. Connect it from the Connect page.",
        policyId: conservative.id,
      },
    });
  }
}

export const workspaceService = new WorkspaceService();
