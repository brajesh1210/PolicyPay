import { Request, Response, NextFunction } from "express";
import { authorizePaymentRequestSchema } from "@policypay/contracts";
import { prisma } from "../config/database";
import { ok } from "../utils/response";
import { ValidationError, ForbiddenError, NotFoundError } from "../utils/errors";
import { pipelineService } from "../services/pipeline.service";

export class AuthorizeController {
  async authorizePayment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // 1. Validate request body with zod
      const parsed = authorizePaymentRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError("Validation failed", parsed.error.format());
      }
      const body = parsed.data;

      // 2. Agent authentication matching
      const authAgentId = req.agentAuth?.agentId;
      if (!authAgentId) {
        throw new ForbiddenError("Missing API key authentication");
      }

      if (body.agent_id !== authAgentId) {
        throw new ForbiddenError("Agent ID in request body does not match authenticated API key");
      }

      const agent = await prisma.agent.findUnique({
        where: { id: authAgentId },
        include: { policy: true },
      });

      if (!agent) {
        throw new NotFoundError("Authenticated agent not found");
      }

      // 3. Evaluate through unified pipeline service
      const result = await pipelineService.evaluate(
        { body, agent },
        { dryRun: false }
      );

      ok(res, result);
    } catch (err) {
      next(err);
    }
  }
}

export const authorizeController = new AuthorizeController();
