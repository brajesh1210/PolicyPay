import { PolicyTemplate, Prisma } from "@prisma/client";
import { prisma } from "../config/database";
import { NotFoundError, ConflictError } from "../utils/errors";

export const POLICY_TEMPLATES = {
  CONSERVATIVE: {
    template: PolicyTemplate.CONSERVATIVE,
    name: "Conservative",
    perTxLimitUsd: 5,
    dailyBudgetUsd: 20,
    monthlyBudgetUsd: 200,
    maxTxPerHour: 20,
    maxTxPerDay: 100,
    approvalThresholdScore: 30,
    denyThresholdScore: 70,
    allowedHoursStart: "08:00",
    allowedHoursEnd: "20:00",
    blockUnknownMerchants: true,
  },
  MODERATE: {
    template: PolicyTemplate.MODERATE,
    name: "Moderate",
    perTxLimitUsd: 25,
    dailyBudgetUsd: 100,
    monthlyBudgetUsd: 1000,
    maxTxPerHour: 30,
    maxTxPerDay: 200,
    approvalThresholdScore: 40,
    denyThresholdScore: 80,
    allowedHoursStart: "06:00",
    allowedHoursEnd: "22:00",
    blockUnknownMerchants: true,
  },
  AGGRESSIVE: {
    template: PolicyTemplate.AGGRESSIVE,
    name: "Aggressive",
    perTxLimitUsd: 100,
    dailyBudgetUsd: 500,
    monthlyBudgetUsd: 5000,
    maxTxPerHour: 100,
    maxTxPerDay: 1000,
    approvalThresholdScore: 50,
    denyThresholdScore: 90,
    allowedHoursStart: null,
    allowedHoursEnd: null,
    blockUnknownMerchants: false,
  },
} as const;

export interface CreatePolicyInput {
  name: string;
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

export interface UpdatePolicyInput {
  name?: string;
  enabled?: boolean;
  perTxLimitUsd?: number;
  dailyBudgetUsd?: number;
  monthlyBudgetUsd?: number;
  maxTxPerHour?: number;
  maxTxPerDay?: number;
  approvalThresholdScore?: number;
  denyThresholdScore?: number;
  allowedHoursStart?: string | null;
  allowedHoursEnd?: string | null;
  blockUnknownMerchants?: boolean;
  allowedCategories?: string[] | null;
  blockedCategories?: string[] | null;
}

export class PoliciesService {
  async list() {
    return prisma.policy.findMany({
      include: {
        _count: {
          select: {
            agents: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  getTemplates() {
    return [
      POLICY_TEMPLATES.CONSERVATIVE,
      POLICY_TEMPLATES.MODERATE,
      POLICY_TEMPLATES.AGGRESSIVE,
    ];
  }

  async getById(id: string) {
    const policy = await prisma.policy.findUnique({
      where: { id },
      include: {
        _count: {
          select: { agents: true },
        },
      },
    });

    if (!policy) {
      throw new NotFoundError("Policy not found");
    }

    return policy;
  }

  async createCustom(input: CreatePolicyInput) {
    return prisma.policy.create({
      data: {
        ...input,
        template: PolicyTemplate.CUSTOM,
        blockUnknownMerchants: input.blockUnknownMerchants ?? true,
        allowedCategories: input.allowedCategories ? (input.allowedCategories as any) : null,
        blockedCategories: input.blockedCategories ? (input.blockedCategories as any) : null,
      },
    });
  }

  async createFromTemplate(templateName: "CONSERVATIVE" | "MODERATE" | "AGGRESSIVE", customName?: string) {
    const tmpl = POLICY_TEMPLATES[templateName];
    if (!tmpl) {
      throw new NotFoundError("Template not found");
    }

    return prisma.policy.create({
      data: {
        template: tmpl.template,
        name: customName || tmpl.name,
        perTxLimitUsd: tmpl.perTxLimitUsd,
        dailyBudgetUsd: tmpl.dailyBudgetUsd,
        monthlyBudgetUsd: tmpl.monthlyBudgetUsd,
        maxTxPerHour: tmpl.maxTxPerHour,
        maxTxPerDay: tmpl.maxTxPerDay,
        approvalThresholdScore: tmpl.approvalThresholdScore,
        denyThresholdScore: tmpl.denyThresholdScore,
        allowedHoursStart: tmpl.allowedHoursStart,
        allowedHoursEnd: tmpl.allowedHoursEnd,
        blockUnknownMerchants: tmpl.blockUnknownMerchants,
      },
    });
  }

  async update(id: string, input: UpdatePolicyInput) {
    await this.getById(id);

    return prisma.policy.update({
      where: { id },
      data: {
        ...input,
        ...(input.allowedCategories !== undefined && {
          allowedCategories: input.allowedCategories as any,
        }),
        ...(input.blockedCategories !== undefined && {
          blockedCategories: input.blockedCategories as any,
        }),
      },
    });
  }

  async toggle(id: string) {
    const policy = await this.getById(id);

    return prisma.policy.update({
      where: { id },
      data: { enabled: !policy.enabled },
    });
  }

  async delete(id: string) {
    const policy = await this.getById(id);

    if (policy._count.agents > 0) {
      throw new ConflictError("Cannot delete policy that is currently assigned to agents");
    }

    return prisma.policy.delete({
      where: { id },
    });
  }
}

export const policiesService = new PoliciesService();
