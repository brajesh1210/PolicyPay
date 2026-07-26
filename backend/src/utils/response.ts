import { Response } from "express";

export function ok<T>(res: Response, data: T, meta?: Record<string, unknown>): Response {
  return res.json({
    success: true,
    data,
    ...(meta && { meta }),
  });
}

export function fail(
  res: Response,
  code: string,
  message: string,
  statusCode: number,
  details?: unknown
): Response {
  return res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      ...(details !== undefined && { details }),
    },
  });
}
