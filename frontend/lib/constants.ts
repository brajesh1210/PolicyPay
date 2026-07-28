export const DECISION_STYLES: Record<string, { label: string; className: string }> = {
  ALLOW: { label: "Allow", className: "bg-green-100 text-green-800" },
  DENY: { label: "Deny", className: "bg-red-100 text-red-800" },
  REQUIRE_APPROVAL: { label: "Require Approval", className: "bg-amber-100 text-amber-800" },
};

export const REPUTATION_STYLES: Record<string, { label: string; className: string }> = {
  TRUSTED: { label: "Trusted", className: "bg-green-100 text-green-800" },
  UNKNOWN: { label: "Unknown", className: "bg-amber-100 text-amber-800" },
  BLOCKED: { label: "Blocked", className: "bg-red-100 text-red-800" },
};

export const SEVERITY_STYLES: Record<string, { label: string; className: string }> = {
  LOW: { label: "Low", className: "bg-green-100 text-green-800" },
  MEDIUM: { label: "Medium", className: "bg-amber-100 text-amber-800" },
  HIGH: { label: "High", className: "bg-red-100 text-red-800" },
};

export function riskColor(score: number): string {
  if (score < 30) return "text-green-600";
  if (score < 70) return "text-amber-600";
  return "text-red-600";
}