export default function DishesLoading() {
  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-6">
      <div>
        <div className="h-7 w-40 animate-pulse rounded-xl bg-slate-200" />
        <div className="mt-2 h-4 w-full max-w-md animate-pulse rounded-lg bg-slate-100" />
      </div>
      <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="h-10 w-full animate-pulse rounded-xl bg-slate-100" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="h-4 w-1/2 animate-pulse rounded bg-slate-200" />
            <div className="mt-2 h-3 w-1/3 animate-pulse rounded bg-slate-100" />
          </div>
        ))}
      </div>
    </div>
  );
}
