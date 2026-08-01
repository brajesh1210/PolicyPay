import { Request } from "express";
import { UnauthorizedError } from "./errors";

/**
 * The workspace the caller belongs to.
 *
 * Every dashboard query must be scoped by this. adminAuth has already
 * verified the JWT, so a missing userId here means the route was mounted
 * without auth — that is a bug, and failing loudly is the safe answer.
 */
export function tenantId(req: Request): string {
  const id = req.user?.userId;
  if (!id) {
    throw new UnauthorizedError("Missing user context on an authenticated route");
  }
  return id;
}
