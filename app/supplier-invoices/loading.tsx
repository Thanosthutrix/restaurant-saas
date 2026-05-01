export default function SupplierInvoicesLoading() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <div className="h-7 w-72 animate-pulse rounded-xl bg-slate-200" />
        <div className="mt-2 h-4 w-96 animate-pulse rounded-lg bg-slate-100" />
      </div>
      <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-slate-100 p-3">
              <div className="h-4 w-1/2 animate-pulse rounded bg-slate-200" />
              <div className="mt-2 h-3 w-1/3 animate-pulse rounded bg-slate-100" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
