import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { MerchantReputation } from "@prisma/client";
import { merchantsService } from "../services/merchants.service";
import { ok } from "../utils/response";
import { ValidationError } from "../utils/errors";

const createMerchantSchema = z.object({
  name: z.string().min(1, "Name is required"),
  domain: z.string().min(1, "Domain is required"),
  category: z.string().min(1, "Category is required"),
  reputation: z.nativeEnum(MerchantReputation).optional(),
});

const updateReputationSchema = z.object({
  reputation: z.nativeEnum(MerchantReputation),
});

export class MerchantsController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const reputation = req.query.reputation as MerchantReputation | undefined;
      const search = req.query.search as string | undefined;
      const merchants = await merchantsService.list(reputation, search);
      ok(res, merchants);
    } catch (err) {
      next(err);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = createMerchantSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError("Validation failed", parsed.error.format());
      }
      const merchant = await merchantsService.create(parsed.data);
      ok(res, merchant);
    } catch (err) {
      next(err);
    }
  }

  async updateReputation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const parsed = updateReputationSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError("Validation failed", parsed.error.format());
      }
      const merchant = await merchantsService.updateReputation(id, parsed.data.reputation);
      ok(res, merchant);
    } catch (err) {
      next(err);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      await merchantsService.delete(id);
      ok(res, { message: "Merchant deleted successfully" });
    } catch (err) {
      next(err);
    }
  }
}

export const merchantsController = new MerchantsController();
