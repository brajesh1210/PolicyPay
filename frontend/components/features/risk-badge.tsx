import React from "react";

interface RiskBadgeProps {
  score: number;
}

export function RiskBadge({ score }: RiskBadgeProps) {
  let color = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
  let label = "LOW";

  if (score >= 70) {
    color = "bg-rose-500/10 text-rose-400 border-rose-500/20";
    label = "HIGH";
  } else if (score >= 30) {
    color = "bg-amber-500/10 text-amber-400 border-amber-500/20";
    label = "MED";
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${color}`}
    >
      <span>{score}</span>
      <span className="opacity-60">• {label}</span>
    </span>
  );
}