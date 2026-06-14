export default function OrdersLoading() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <div className="h-7 w-64 animate-pulse rounded-xl bg-stone-200" />
        <div className="mt-2 h-4 w-80 animate-pulse rounded-lg bg-stone-100" />
      </div>
      <div className="rounded-2xl border border-stone-100 bg-white p-4 shadow-sm">
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between gap-4 rounded-xl bg-stone-50 px-3 py-3">
              <div className="h-4 w-1/2 animate-pulse rounded bg-stone-200" />
              <div className="h-4 w-24 animate-pulse rounded bg-stone-100" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
