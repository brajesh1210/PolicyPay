import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { policiesService } from "../services/policies.service";
import { ok } from "../utils/response";
import { ValidationError } from "../utils/errors";

const createCustomPolicySchema = z.object({
  name: z.string().min(1, "Name is required"),
  perTxLimitUsd: z.number().positive(),
  dailyBudgetUsd: z.number().positive(),
  monthlyBudgetUsd: z.number().positive(),
  maxTxPerHour: z.number().int().positive(),
  maxTxPerDay: z.number().int().positive(),
  approvalThresholdScore: z.number().int().min(0).max(100),
  denyThresholdScore: z.number().int().min(0).max(100),
  allowedHoursStart: z.string().nullable().optional(),
  allowedHoursEnd: z.string().nullable().optional(),
  blockUnknownMerchants: z.boolean().optional(),
  allowedCategories: z.array(z.string()).nullable().optional(),
  blockedCategories: z.array(z.string()).nullable().optional(),
});

const updatePolicySchema = createCustomPolicySchema.partial().extend({
  enabled: z.boolean().optional(),
});

const fromTemplateSchema = z.object({
  template: z.enum(["CONSERVATIVE", "MODERATE", "AGGRESSIVE"]),
  name: z.string().min(1).optional(),
});

export class PoliciesController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const policies = await policiesService.list();
      ok(res, policies);
    } catch (err) {
      next(err);
    }
  }

  async getTemplates(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const templates = policiesService.getTemplates();
      ok(res, templates);
    } catch (err) {
      next(err);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const policy = await policiesService.getById(id);
      ok(res, policy);
    } catch (err) {
      next(err);
    }
  }

  async createCustom(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = createCustomPolicySchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError("Validation failed", parsed.error.format());
      }
      const policy = await policiesService.createCustom(parsed.data);
      ok(res, policy);
    } catch (err) {
      next(err);
    }
  }

  async createFromTemplate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = fromTemplateSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError("Validation failed", parsed.error.format());
      }
      const policy = await policiesService.createFromTemplate(
        parsed.data.template,
        parsed.data.name
      );
      ok(res, policy);
    } catch (err) {
      next(err);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const parsed = updatePolicySchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError("Validation failed", parsed.error.format());
      }
      const policy = await policiesService.update(id, parsed.data);
      ok(res, policy);
    } catch (err) {
      next(err);
    }
  }

  async toggle(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const policy = await policiesService.toggle(id);
      ok(res, policy);
    } catch (err) {
      next(err);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      await policiesService.delete(id);
      ok(res, { message: "Policy deleted successfully" });
    } catch (err) {
      next(err);
    }
  }
}

export const policiesController = new PoliciesController();
