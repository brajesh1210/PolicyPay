import { Request, Response, NextFunction } from "express";
import { analyticsService } from "../services/analytics.service";
import { ok } from "../utils/response";
import { tenantId } from "../utils/tenant";

export class AnalyticsController {
  async getOverview(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const overview = await analyticsService.getOverview(tenantId(req));
      ok(res, overview);
    } catch (err) {
      next(err);
    }
  }

  async getSpendingTrends(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const days = req.query.days ? parseInt(req.query.days as string, 10) : 7;
      const trends = await analyticsService.getSpendingTrends(tenantId(req), isNaN(days) ? 7 : days);
      ok(res, trends);
    } catch (err) {
      next(err);
    }
  }

  async getStatusDistribution(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const distribution = await analyticsService.getStatusDistribution(tenantId(req));
      ok(res, distribution);
    } catch (err) {
      next(err);
    }
  }

  async getRecentTransactions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 5;
      const recent = await analyticsService.getRecentTransactions(tenantId(req), isNaN(limit) ? 5 : limit);
      ok(res, recent);
    } catch (err) {
      next(err);
    }
  }
}

export const analyticsController = new AnalyticsController();
