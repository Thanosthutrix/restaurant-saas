export default function DashboardLoading() {
  return (
    <div className="mx-auto max-w-6xl animate-pulse space-y-8">
      <div className="space-y-2">
        <div className="h-8 w-48 rounded-xl bg-slate-200" />
        <div className="h-4 w-64 rounded-lg bg-slate-100" />
      </div>
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="h-10 w-10 rounded-xl bg-slate-100" />
            <div className="mt-3 h-4 w-20 rounded bg-slate-200" />
            <div className="mt-2 h-3 w-full rounded bg-slate-100" />
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="h-20 w-20 rounded-full bg-slate-100" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-32 rounded bg-slate-200" />
            <div className="h-3 w-48 rounded bg-slate-100" />
          </div>
        </div>
      </div>
    </div>
  );
}
