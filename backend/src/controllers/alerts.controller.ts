import { Request, Response, NextFunction } from "express";
import { AlertSeverity } from "@prisma/client";
import { alertsService } from "../services/alerts.service";
import { ok } from "../utils/response";
import { tenantId } from "../utils/tenant";

export class AlertsController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      let is_dismissed: boolean | undefined = undefined;
      if (req.query.is_dismissed === "true") {
        is_dismissed = true;
      } else if (req.query.is_dismissed === "false") {
        is_dismissed = false;
      }

      let severity: AlertSeverity | undefined = undefined;
      if (
        req.query.severity === "HIGH" ||
        req.query.severity === "MEDIUM" ||
        req.query.severity === "LOW"
      ) {
        severity = req.query.severity as AlertSeverity;
      }

      const alerts = await alertsService.list(tenantId(req), { is_dismissed, severity });
      ok(res, alerts);
    } catch (err) {
      next(err);
    }
  }

  async markRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const alert = await alertsService.markRead(id);
      ok(res, alert);
    } catch (err) {
      next(err);
    }
  }

  async dismiss(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const alert = await alertsService.dismiss(id);
      ok(res, alert);
    } catch (err) {
      next(err);
    }
  }
}

export const alertsController = new AlertsController();
