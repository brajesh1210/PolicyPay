import { Role } from "@prisma/client";

export interface JwtPayload {
  userId: string;
  email: string;
  role: Role | string;
}

export interface AgentAuth {
  agentId: string;
  apiKeyId: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
      agentAuth?: AgentAuth;
    }
  }
}
