import { z } from "zod";

// 1) Union type
export type Decision = "ALLOW" | "DENY" | "REQUIRE_APPROVAL";

// 2) Interfaces
export interface AuthorizePaymentRequest {
  agent_id: string;
  merchant: {
    domain: string;
    name?: string;
  };
  amount_usd: number;
  currency: string;
  purpose?: string;
  idempotency_key: string;
}

export interface PolicyCheck {
  check: string;
  passed: boolean;
  detail?: string;
}

export interface RiskFactor {
  factor: string;
  points: number;
  detail?: string;
}

export interface X402Payment {
  signed_payload: string;
  network: string;
}

export interface AuthorizePaymentResponseData {
  transaction_id: string;
  decision: Decision;
  risk_score: number;
  reason_codes: string[];
  policy_checks: PolicyCheck[];
  risk_breakdown: RiskFactor[];
  x402_payment?: X402Payment;
  approval_id?: string;
}

// 3) Response envelopes
export interface SuccessEnvelope<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

export interface ErrorEnvelope {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

// 4) Zod schema
export const authorizePaymentRequestSchema: z.ZodType<AuthorizePaymentRequest> = z.object({
  agent_id: z.string().min(1),
  merchant: z.object({
    domain: z.string().min(1),
    name: z.string().optional(),
  }),
  amount_usd: z.number().positive().finite(),
  currency: z.string().min(1),
  purpose: z.string().max(500).optional(),
  idempotency_key: z.string().min(1),
});

// 5) ERROR_CODES
export const ERROR_CODES = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  UNAUTHORIZED: "UNAUTHORIZED",
  INVALID_API_KEY: "INVALID_API_KEY",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  DUPLICATE_RESOURCE: "DUPLICATE_RESOURCE",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;

// 6) REASON_CODES
export const REASON_CODES = {
  KILL_SWITCH_ACTIVE: "KILL_SWITCH_ACTIVE",
  AGENT_KILL_SWITCH_ACTIVE: "AGENT_KILL_SWITCH_ACTIVE",
  AGENT_INACTIVE: "AGENT_INACTIVE",
  POLICY_DISABLED: "POLICY_DISABLED",
  DUPLICATE_INTENT: "DUPLICATE_INTENT",
  MERCHANT_BLOCKED: "MERCHANT_BLOCKED",
  MERCHANT_NOT_ALLOWED: "MERCHANT_NOT_ALLOWED",
  CATEGORY_BLOCKED: "CATEGORY_BLOCKED",
  PER_TX_LIMIT_EXCEEDED: "PER_TX_LIMIT_EXCEEDED",
  DAILY_BUDGET_EXCEEDED: "DAILY_BUDGET_EXCEEDED",
  MONTHLY_BUDGET_EXCEEDED: "MONTHLY_BUDGET_EXCEEDED",
  HOURLY_FREQUENCY_EXCEEDED: "HOURLY_FREQUENCY_EXCEEDED",
  DAILY_FREQUENCY_EXCEEDED: "DAILY_FREQUENCY_EXCEEDED",
  UNKNOWN_MERCHANT_RISK: "UNKNOWN_MERCHANT_RISK",
  AMOUNT_ANOMALY: "AMOUNT_ANOMALY",
  FREQUENCY_BURST: "FREQUENCY_BURST",
  OFF_HOURS: "OFF_HOURS",
  PROMPT_INJECTION_SUSPECTED: "PROMPT_INJECTION_SUSPECTED",
  RISK_THRESHOLD_DENY: "RISK_THRESHOLD_DENY",
  RISK_THRESHOLD_APPROVAL: "RISK_THRESHOLD_APPROVAL",
  ALL_CHECKS_PASSED: "ALL_CHECKS_PASSED",
} as const;

export type ReasonCode = keyof typeof REASON_CODES;
