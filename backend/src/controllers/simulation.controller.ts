import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { authorizePaymentRequestSchema } from "@policypay/contracts";
import { simulationService } from "../services/simulation.service";
import { ok } from "../utils/response";
import { ValidationError } from "../utils/errors";

const policyDraftSchema = z.object({
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

const replaySchema = z.object({
  policyDraft: policyDraftSchema,
  lastN: z.number().int().positive().max(200).default(20),
});

export class SimulationController {
  async simulate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = authorizePaymentRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError("Validation failed", parsed.error.format());
      }

      const result = await simulationService.simulate(parsed.data);
      ok(res, result);
    } catch (err) {
      next(err);
    }
  }

  async replay(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = replaySchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError("Validation failed", parsed.error.format());
      }

      const { policyDraft, lastN } = parsed.data;
      const result = await simulationService.replay(policyDraft, lastN);
      ok(res, result);
    } catch (err) {
      next(err);
    }
  }
}

export const simulationController = new SimulationController();
