export default function EquipeLoading() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6">
      <div>
        <div className="h-7 w-56 animate-pulse rounded-xl bg-slate-200" />
        <div className="mt-2 h-4 w-full max-w-xl animate-pulse rounded-lg bg-slate-100" />
      </div>
      <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: 35 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      </div>
    </div>
  );
}
