import bcrypt from "bcrypt";
import crypto from "crypto";
import { AgentStatus, Prisma } from "@prisma/client";
import { prisma } from "../config/database";
import { NotFoundError } from "../utils/errors";
import { alertsService } from "./alerts.service";

export interface CreateAgentInput {
  name: string;
  description?: string;
  policyId: string;
  status?: AgentStatus;
}

export interface UpdateAgentInput {
  name?: string;
  description?: string;
  policyId?: string;
  status?: AgentStatus;
}

export class AgentsService {
  async list(status?: AgentStatus, search?: string) {
    const where: Prisma.AgentWhereInput = {};

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    return prisma.agent.findMany({
      where,
      include: {
        policy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async getById(id: string) {
    const agent = await prisma.agent.findUnique({
      where: { id },
      include: {
        policy: true,
      },
    });

    if (!agent) {
      throw new NotFoundError("Agent not found");
    }

    return agent;
  }

  async create(input: CreateAgentInput) {
    const policyExists = await prisma.policy.findUnique({
      where: { id: input.policyId },
    });

    if (!policyExists) {
      throw new NotFoundError("Policy not found");
    }

    return prisma.agent.create({
      data: {
        name: input.name,
        description: input.description || null,
        policyId: input.policyId,
        status: input.status || AgentStatus.ACTIVE,
      },
      include: {
        policy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async update(id: string, input: UpdateAgentInput) {
    await this.getById(id);

    if (input.policyId) {
      const policyExists = await prisma.policy.findUnique({
        where: { id: input.policyId },
      });
      if (!policyExists) {
        throw new NotFoundError("Policy not found");
      }
    }

    return prisma.agent.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.policyId !== undefined && { policyId: input.policyId }),
        ...(input.status !== undefined && { status: input.status }),
      },
      include: {
        policy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async delete(id: string) {
    await this.getById(id);
    return prisma.agent.delete({
      where: { id },
    });
  }

  async setKillSwitch(id: string, active: boolean) {
    const agent = await this.getById(id);

    const updated = await prisma.agent.update({
      where: { id },
      data: { killSwitchActive: active },
    });

    if (active) {
      await alertsService.onKillSwitch(agent.id);
    }

    return updated;
  }

  async createApiKey(agentId: string, name: string) {
    await this.getById(agentId);

    const fullKey = "pp_live_" + crypto.randomBytes(16).toString("hex");
    const keyPrefix = fullKey.slice(0, 12);
    const keyHash = await bcrypt.hash(fullKey, 10);

    const apiKey = await prisma.apiKey.create({
      data: {
        agentId,
        name,
        keyPrefix,
        keyHash,
      },
    });

    return {
      id: apiKey.id,
      name: apiKey.name,
      keyPrefix: apiKey.keyPrefix,
      apiKey: fullKey,
      createdAt: apiKey.createdAt,
    };
  }

  async listApiKeys(agentId: string) {
    await this.getById(agentId);

    return prisma.apiKey.findMany({
      where: { agentId },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        lastUsedAt: true,
        revokedAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async revokeApiKey(agentId: string, keyId: string) {
    await this.getById(agentId);

    const apiKey = await prisma.apiKey.findFirst({
      where: { id: keyId, agentId },
    });

    if (!apiKey) {
      throw new NotFoundError("API key not found for this agent");
    }

    return prisma.apiKey.update({
      where: { id: keyId },
      data: { revokedAt: new Date() },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        lastUsedAt: true,
        revokedAt: true,
        createdAt: true,
      },
    });
  }
}

export const agentsService = new AgentsService();
