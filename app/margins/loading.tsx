export default function MarginsLoading() {
  return (
    <div className="mx-auto max-w-6xl animate-pulse space-y-6 px-4 py-6">
      <div className="h-8 w-40 rounded-xl bg-stone-200" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-stone-100 bg-white p-5 shadow-sm">
            <div className="h-3 w-24 rounded bg-stone-100" />
            <div className="mt-3 h-7 w-16 rounded-lg bg-stone-200" />
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-stone-100 bg-white shadow-sm">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between border-b border-stone-100 px-6 py-4">
            <div className="h-4 w-40 rounded bg-stone-200" />
            <div className="h-4 w-16 rounded bg-stone-100" />
          </div>
        ))}
      </div>
    </div>
  );
}

