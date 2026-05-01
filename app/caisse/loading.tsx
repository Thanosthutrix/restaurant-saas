export default function CaisseLoading() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-4">
      <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="h-5 w-40 animate-pulse rounded-lg bg-slate-200" />
        <div className="mt-4 space-y-2">
          <div className="h-10 w-full animate-pulse rounded-xl bg-slate-100" />
          <div className="h-10 w-full animate-pulse rounded-xl bg-slate-100" />
          <div className="h-10 w-2/3 animate-pulse rounded-xl bg-slate-100" />
        </div>
      </div>
      <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="h-4 w-24 animate-pulse rounded bg-slate-200" />
        <div className="mt-3 h-12 w-full animate-pulse rounded-xl bg-slate-100" />
      </div>
    </div>
  );
}
