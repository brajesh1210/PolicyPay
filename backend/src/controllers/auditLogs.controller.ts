import { Request, Response, NextFunction } from "express";
import { auditLogService } from "../services/auditLog.service";
import { ok } from "../utils/response";
import { tenantId } from "../utils/tenant";

export class AuditLogsController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;

      const result = await auditLogService.list(tenantId(req), 
        isNaN(page) || page < 1 ? 1 : page,
        isNaN(limit) || limit < 1 ? 20 : limit
      );

      ok(res, result.logs, {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      });
    } catch (err) {
      next(err);
    }
  }
}

export const auditLogsController = new AuditLogsController();
