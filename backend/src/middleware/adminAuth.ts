import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { UnauthorizedError } from "../utils/errors";
import { JwtPayload } from "../types/express";

export function adminAuth(req: Request, _res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new UnauthorizedError("Authorization header missing or invalid format");
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      throw new UnauthorizedError("Bearer token missing");
    }

    try {
      const decoded = jwt.verify(token, env.API_JWT_SECRET) as JwtPayload;
      req.user = {
        userId: decoded.userId,
        email: decoded.email,
        role: decoded.role,
      };
      next();
    } catch {
      throw new UnauthorizedError("Invalid or expired token");
    }
  } catch (err) {
    next(err);
  }
}
