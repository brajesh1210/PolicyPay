import { Request, Response, NextFunction, ErrorRequestHandler } from "express";
import { AppError } from "../utils/errors";
import { fail } from "../utils/response";
import { ERROR_CODES } from "@policypay/contracts";

export const errorHandler: ErrorRequestHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  console.error("Unhandled Error:", err);

  if (err instanceof AppError) {
    fail(res, err.code, err.message, err.statusCode, err.details);
    return;
  }

  const message = err instanceof Error ? err.message : "Internal server error";
  fail(res, ERROR_CODES.INTERNAL_ERROR, message, 500);
};
