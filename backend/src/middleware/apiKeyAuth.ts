import { Request, Response, NextFunction } from "express";
import bcrypt from "bcrypt";
import { prisma } from "../config/database";
import { InvalidApiKeyError } from "../utils/errors";

export async function apiKeyAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new InvalidApiKeyError("Authorization header missing or invalid format");
    }

    const apiKey = authHeader.split(" ")[1];
    if (!apiKey || !apiKey.startsWith("pp_live_")) {
      throw new InvalidApiKeyError("API key missing or invalid format");
    }

    const keyPrefix = apiKey.slice(0, 12);

    const candidates = await prisma.apiKey.findMany({
      where: {
        keyPrefix,
        revokedAt: null,
      },
    });

    if (candidates.length === 0) {
      throw new InvalidApiKeyError("Invalid API key");
    }

    let matchedKey = null;
    for (const candidate of candidates) {
      const isMatch = await bcrypt.compare(apiKey, candidate.keyHash);
      if (isMatch) {
        matchedKey = candidate;
        break;
      }
    }

    if (!matchedKey) {
      throw new InvalidApiKeyError("Invalid API key");
    }

    req.agentAuth = {
      agentId: matchedKey.agentId,
      apiKeyId: matchedKey.id,
    };

    await prisma.apiKey.update({
      where: { id: matchedKey.id },
      data: { lastUsedAt: new Date() },
    });

    next();
  } catch (err) {
    next(err);
  }
}
