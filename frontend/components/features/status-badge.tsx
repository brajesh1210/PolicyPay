import React from "react";

interface StatusBadgeProps {
  status: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const normalized = status?.toUpperCase() || "UNKNOWN";

  const styles: Record<string, string> = {
    APPROVED: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    DENIED: "bg-rose-500/10 text-rose-400 border-rose-500/20",
    PENDING: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    REJECTED: "bg-rose-500/10 text-rose-400 border-rose-500/20",
  };

  const currentStyle =
    styles[normalized] || "bg-slate-500/10 text-slate-400 border-slate-500/20";

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${currentStyle}`}
    >
      {normalized}
    </span>
  );
}