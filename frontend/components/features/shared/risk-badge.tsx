export function RiskBadge({ score }: { score: number }) {
  let color = "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
  if (score > 70) color = "text-red-400 bg-red-500/10 border-red-500/20";
  else if (score > 30) color = "text-amber-400 bg-amber-500/10 border-amber-500/20";

  return (
    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold border ${color}`}>
      Risk: {score}
    </span>
  );
}