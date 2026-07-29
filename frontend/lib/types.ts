/* Shapes verified against the live Railway backend on 29 Jul 2026. */

export type Decision = "ALLOW" | "DENY" | "REQUIRE_APPROVAL";
export type Reputation = "TRUSTED" | "UNKNOWN" | "BLOCKED";
export type AgentStatus = "ACTIVE" | "PAUSED" | "REVOKED";
export type Severity = "HIGH" | "MEDIUM" | "LOW";
export type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED";

export interface Overview {
  total_spend_today: number;
  total_spend_today_change_pct: number;
  blocked_today: number;
  pending_approvals: number;
  active_agents: number;
}

export interface TrendPoint {
  date: string;
  amount: number;
  count: number;
}
export interface SpendingTrends {
  trends: TrendPoint[];
}

export interface StatusDistribution {
  allow: number;
  deny: number;
  require_approval: number;
  total: number;
}

export interface RecentTx {
  id: string;
  agentName: string;
  merchantDomain: string;
  amountUsd: number;
  decision: Decision;
  riskScore: number;
  createdAt: string;
}
export interface RecentTransactions {
  transactions: RecentTx[];
}

export interface PolicyCheck {
  check: string;
  passed: boolean;
  detail: string;
}

export interface RiskFactor {
  factor: string;
  points: number;
  detail?: string;
}

export interface Transaction {
  id: string;
  agentId: string;
  merchantDomain: string;
  merchantName?: string | null;
  amountUsd: number;
  currency: string;
  purpose?: string | null;
  idempotencyKey?: string;
  decision: Decision;
  riskScore: number;
  reasonCodes: string[];
  policyChecks?: PolicyCheck[];
  riskFactors?: RiskFactor[];
  latencyMs?: number | null;
  createdAt: string;
  agent?: { id: string; name: string };
}

export interface Policy {
  id: string;
  name: string;
  template: "CONSERVATIVE" | "MODERATE" | "AGGRESSIVE" | string;
  enabled: boolean;
  perTxLimitUsd: number;
  dailyBudgetUsd: number;
  monthlyBudgetUsd: number;
  maxTxPerHour: number;
  maxTxPerDay: number;
  approvalThresholdScore: number;
  denyThresholdScore: number;
  allowedHoursStart: string | null;
  allowedHoursEnd: string | null;
  blockUnknownMerchants: boolean;
  allowedCategories: string[] | null;
  blockedCategories: string[] | null;
  createdAt: string;
  updatedAt: string;
  _count?: { agents: number };
}

export interface Agent {
  id: string;
  name: string;
  description?: string | null;
  status: AgentStatus;
  killSwitchActive: boolean;
  trustScore: number;
  policyId: string;
  lastActiveAt: string | null;
  totalSpent: number;
  totalTx: number;
  createdAt: string;
  updatedAt: string;
  policy?: { id: string; name: string };
}

export interface Merchant {
  id: string;
  name: string;
  domain: string;
  category: string;
  reputation: Reputation;
  createdAt: string;
  updatedAt: string;
}

export interface Approval {
  id: string;
  transactionId: string;
  agentId: string;
  status: ApprovalStatus;
  reason: string;
  note: string | null;
  decidedAt: string | null;
  expiresAt: string;
  createdAt: string;
  agent?: { id: string; name: string };
  transaction?: {
    id: string;
    amountUsd: number;
    merchantDomain: string;
    purpose?: string | null;
    riskScore: number;
    reasonCodes: string[];
  };
}

export interface Alert {
  id: string;
  type: string;
  severity: Severity;
  title: string;
  description: string;
  agentId: string | null;
  isRead: boolean;
  isDismissed: boolean;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  transactionId: string | null;
  payloadHash: string;
  prevHash: string | null;
  createdAt: string;
  transaction?: {
    merchantDomain: string;
    amountUsd: number;
    agent?: { name: string };
  } | null;
}

export interface SimulateResult {
  decision: Decision;
  risk_score: number;
  reason_codes: string[];
  policy_checks: PolicyCheck[];
  risk_factors?: RiskFactor[];
  latency_ms?: number;
}
