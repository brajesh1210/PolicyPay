import { ERROR_CODES } from "@policypay/contracts";

export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: unknown;

  constructor(code: string, message: string, statusCode: number, details?: unknown) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(ERROR_CODES.VALIDATION_ERROR, message, 400, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = "Unauthorized", details?: unknown) {
    super(ERROR_CODES.UNAUTHORIZED, message, 401, details);
  }
}

export class InvalidApiKeyError extends AppError {
  constructor(message: string = "Invalid API key", details?: unknown) {
    super(ERROR_CODES.INVALID_API_KEY, message, 401, details);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = "Forbidden", details?: unknown) {
    super(ERROR_CODES.FORBIDDEN, message, 403, details);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = "Not found", details?: unknown) {
    super(ERROR_CODES.NOT_FOUND, message, 404, details);
  }
}

export class ConflictError extends AppError {
  constructor(message: string = "Resource conflict", details?: unknown) {
    super(ERROR_CODES.DUPLICATE_RESOURCE, message, 409, details);
  }
}
