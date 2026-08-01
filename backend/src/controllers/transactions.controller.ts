import { Request, Response, NextFunction } from "express";
import { TransactionDecision } from "@prisma/client";
import { transactionsService } from "../services/transactions.service";
import { ok } from "../utils/response";
import { tenantId } from "../utils/tenant";

export class TransactionsController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const decision = req.query.decision as TransactionDecision | undefined;
      const agentId = req.query.agentId as string | undefined;
      const merchant = req.query.merchant as string | undefined;

      const dateFromStr = req.query.dateFrom as string | undefined;
      const dateToStr = req.query.dateTo as string | undefined;

      const dateFrom = dateFromStr ? new Date(dateFromStr) : undefined;
      const dateTo = dateToStr ? new Date(dateToStr) : undefined;

      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;

      const result = await transactionsService.list(tenantId(req), {
        decision,
        agentId,
        merchant,
        dateFrom: dateFrom && !isNaN(dateFrom.getTime()) ? dateFrom : undefined,
        dateTo: dateTo && !isNaN(dateTo.getTime()) ? dateTo : undefined,
        page: isNaN(page) ? 1 : page,
        limit: isNaN(limit) ? 20 : limit,
      });

      ok(res, result.transactions, {
        total: result.total,
        page: result.page,
        limit: result.limit,
      });
    } catch (err) {
      next(err);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const transaction = await transactionsService.getById(id);
      ok(res, transaction);
    } catch (err) {
      next(err);
    }
  }
}

export const transactionsController = new TransactionsController();
