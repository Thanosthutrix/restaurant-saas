export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-5xl motion-safe:animate-pulse space-y-6">
      <div className="space-y-2">
        <div className="h-7 w-56 rounded-xl bg-stone-200" />
        <div className="h-4 w-full max-w-xl rounded-lg bg-stone-100" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-stone-100 bg-white p-4 shadow-sm">
            <div className="h-3 w-24 rounded bg-stone-100" />
            <div className="mt-3 h-7 w-14 rounded bg-stone-200" />
            <div className="mt-2 h-3 w-32 rounded bg-stone-100" />
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-stone-100 bg-white p-4 shadow-sm">
        <div className="h-4 w-40 rounded bg-stone-200" />
        <div className="mt-4 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between gap-4">
              <div className="h-4 w-2/3 rounded bg-stone-100" />
              <div className="h-4 w-20 rounded bg-stone-100" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
