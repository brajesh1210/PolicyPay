export function TopBar({ title }: { title: string }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-800 pb-4">
      <h1 className="text-2xl font-bold text-slate-100">{title}</h1>
    </div>
  );
}