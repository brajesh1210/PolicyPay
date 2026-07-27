import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { globalConfigService } from "../services/globalConfig.service";
import { alertsService } from "../services/alerts.service";
import { ok } from "../utils/response";
import { ValidationError } from "../utils/errors";

const killSwitchSchema = z.object({
  active: z.boolean(),
});

export class KillSwitchController {
  async getStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const config = await globalConfigService.getConfig();
      ok(res, { active: config.killSwitchActive });
    } catch (err) {
      next(err);
    }
  }

  async setStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = killSwitchSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError("Validation failed", parsed.error.format());
      }

      const { active } = parsed.data;
      const config = await globalConfigService.setKillSwitch(active);

      if (active) {
        await alertsService.onKillSwitch();
      }

      ok(res, { active: config.killSwitchActive });
    } catch (err) {
      next(err);
    }
  }
}

export const killSwitchController = new KillSwitchController();
