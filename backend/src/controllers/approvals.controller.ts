import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { ApprovalStatus } from "@prisma/client";
import { approvalsService } from "../services/approvals.service";
import { ok } from "../utils/response";
import { tenantId } from "../utils/tenant";
import { ValidationError } from "../utils/errors";

const actionBodySchema = z.object({
  note: z.string().optional(),
});

export class ApprovalsController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const status = req.query.status as ApprovalStatus | undefined;
      const approvals = await approvalsService.list(tenantId(req), status);
      ok(res, approvals);
    } catch (err) {
      next(err);
    }
  }

  async approve(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      let note: string | undefined = undefined;

      if (req.body && Object.keys(req.body).length > 0) {
        const parsed = actionBodySchema.safeParse(req.body);
        if (!parsed.success) {
          throw new ValidationError("Validation failed", parsed.error.format());
        }
        note = parsed.data.note;
      }

      const result = await approvalsService.approve(id, note);
      ok(res, result);
    } catch (err) {
      next(err);
    }
  }

  async reject(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      let note: string | undefined = undefined;

      if (req.body && Object.keys(req.body).length > 0) {
        const parsed = actionBodySchema.safeParse(req.body);
        if (!parsed.success) {
          throw new ValidationError("Validation failed", parsed.error.format());
        }
        note = parsed.data.note;
      }

      const result = await approvalsService.reject(id, note);
      ok(res, result);
    } catch (err) {
      next(err);
    }
  }
}

export const approvalsController = new ApprovalsController();
