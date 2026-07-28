import { Check, X } from "lucide-react";

export function PolicyCheckList({ checks }: { checks: any[] }) {
  if (!checks?.length) return <p className="text-xs text-slate-500">No policy checks recorded</p>;
  
  return (
    <ul className="space-y-2">
      {checks.map((c, i) => (
        <li key={i} className="flex items-center gap-2 text-xs">
          {c.passed ? (
            <Check className="h-3.5 w-3.5 text-emerald-500" />
          ) : (
            <X className="h-3.5 w-3.5 text-red-500" />
          )}
          <span className={c.passed ? "text-slate-300" : "text-slate-100 font-semibold"}>
            {c.name}
          </span>
        </li>
      ))}
    </ul>
  );
}