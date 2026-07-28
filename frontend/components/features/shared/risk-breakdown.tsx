export function RiskBreakdown({ breakdown, total }: { breakdown: any[], total: number }) {
  if (!breakdown?.length) return <p className="text-xs text-slate-500">No breakdown available</p>;
  
  return (
    <div className="space-y-2 bg-slate-900/50 p-3 rounded-lg border border-slate-800">
      {breakdown.map((b, i) => (
        <div key={i} className="flex justify-between text-xs">
          <span className="text-slate-400">{b.factor}</span>
          <span className="text-slate-200 font-mono">+{b.score}</span>
        </div>
      ))}
      <div className="pt-2 mt-2 border-t border-slate-800 flex justify-between text-xs font-bold text-slate-200">
        <span>Total Score</span>
        <span>{total}</span>
      </div>
    </div>
  );
}