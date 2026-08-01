import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { AgentStatus } from "@prisma/client";
import { agentsService } from "../services/agents.service";
import { ok } from "../utils/response";
import { tenantId } from "../utils/tenant";
import { ValidationError } from "../utils/errors";

const createAgentSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  policyId: z.string().min(1, "Policy ID is required"),
  status: z.nativeEnum(AgentStatus).optional(),
});

const updateAgentSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  policyId: z.string().min(1).optional(),
  status: z.nativeEnum(AgentStatus).optional(),
});

const killSwitchSchema = z.object({
  active: z.boolean(),
});

const createApiKeySchema = z.object({
  name: z.string().min(1, "Key name is required"),
});

export class AgentsController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const status = req.query.status as AgentStatus | undefined;
      const search = req.query.search as string | undefined;
      const agents = await agentsService.list(tenantId(req), status, search);
      ok(res, agents);
    } catch (err) {
      next(err);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const agent = await agentsService.getById(id);
      ok(res, agent);
    } catch (err) {
      next(err);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = createAgentSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError("Validation failed", parsed.error.format());
      }
      const agent = await agentsService.create(tenantId(req), parsed.data);
      ok(res, agent);
    } catch (err) {
      next(err);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const parsed = updateAgentSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError("Validation failed", parsed.error.format());
      }
      const agent = await agentsService.update(id, parsed.data);
      ok(res, agent);
    } catch (err) {
      next(err);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      await agentsService.delete(id);
      ok(res, { message: "Agent deleted successfully" });
    } catch (err) {
      next(err);
    }
  }

  async setKillSwitch(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const parsed = killSwitchSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError("Validation failed", parsed.error.format());
      }
      const agent = await agentsService.setKillSwitch(id, parsed.data.active);
      ok(res, agent);
    } catch (err) {
      next(err);
    }
  }

  async createApiKey(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const parsed = createApiKeySchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError("Validation failed", parsed.error.format());
      }
      const result = await agentsService.createApiKey(id, parsed.data.name);
      ok(res, result);
    } catch (err) {
      next(err);
    }
  }

  async listApiKeys(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const keys = await agentsService.listApiKeys(id);
      ok(res, keys);
    } catch (err) {
      next(err);
    }
  }

  async revokeApiKey(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id, keyId } = req.params;
      const result = await agentsService.revokeApiKey(id, keyId);
      ok(res, result);
    } catch (err) {
      next(err);
    }
  }
}

export const agentsController = new AgentsController();
