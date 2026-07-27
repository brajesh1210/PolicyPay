import crypto from "crypto";
import { redis } from "../config/redis";
import { env } from "../config/env";

export class DuplicateGuardService {
  buildHash(agentId: string, merchantDomain: string, amountUsd: number, idempotencyKey: string): string {
    const raw = `${agentId}|${merchantDomain}|${amountUsd}|${idempotencyKey}`;
    return crypto.createHash("sha256").update(raw).digest("hex");
  }

  async checkAndReserve(hash: string): Promise<boolean> {
    const key = `intent:${hash}`;
    const result = await redis.set(key, "1", "EX", env.DUPLICATE_GUARD_TTL_SECONDS, "NX");
    return result === "OK";
  }

  async release(hash: string): Promise<void> {
    const key = `intent:${hash}`;
    await redis.del(key);
  }
}

export const duplicateGuardService = new DuplicateGuardService();
