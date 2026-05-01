export default function SalleLoading() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
      <div>
        <div className="h-7 w-28 animate-pulse rounded-xl bg-slate-200" />
        <div className="mt-2 h-4 w-64 animate-pulse rounded-lg bg-slate-100" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="h-4 w-24 animate-pulse rounded bg-slate-200" />
            <div className="mt-2 h-3 w-40 animate-pulse rounded bg-slate-100" />
          </div>
        ))}
      </div>
    </div>
  );
}
