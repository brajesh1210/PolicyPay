import { ReactNode } from "react";

export function EmptyState({ 
  icon, 
  title, 
  description 
}: { 
  icon?: ReactNode; 
  title: string; 
  description?: string; 
}) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center border border-slate-800 border-dashed rounded-xl bg-slate-900/30">
      {icon && <div className="mb-4">{icon}</div>}
      <h3 className="text-lg font-semibold text-slate-200">{title}</h3>
      {description && <p className="text-sm text-slate-400 mt-2 max-w-sm">{description}</p>}
    </div>
  );
}