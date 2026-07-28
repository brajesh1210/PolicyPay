import { CheckCircle, XCircle, Clock } from "lucide-react";

export function DecisionBadge({ decision }: { decision: string }) {
  if (decision === "ALLOW") {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
        <CheckCircle className="h-3 w-3" /> Allow
      </span>
    );
  }
  if (decision === "DENY") {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
        <XCircle className="h-3 w-3" /> Deny
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
      <Clock className="h-3 w-3" /> Review
    </span>
  );
}