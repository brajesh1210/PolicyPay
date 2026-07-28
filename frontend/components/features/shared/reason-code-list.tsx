export const REASON_TEXT: Record<string, string> = {
  "HIGH_RISK_SCORE": "Overall risk score exceeded threshold",
  "UNKNOWN_MERCHANT": "Merchant has no prior history",
  "BUDGET_EXCEEDED": "Transaction exceeds remaining budget",
  "VELOCITY_LIMIT": "Too many transactions in a short time",
  "SUSPICIOUS_PATTERN": "Matches known fraud patterns"
};

export function ReasonCodeList({ codes }: { codes: string[] }) {
  if (!codes?.length) return <p className="text-xs text-slate-500">No specific reasons</p>;
  return (
    <ul className="space-y-1">
      {codes.map(c => (
        <li key={c} className="text-xs text-slate-300">
          • {REASON_TEXT[c] || c}
        </li>
      ))}
    </ul>
  );
}