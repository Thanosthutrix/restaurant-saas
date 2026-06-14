export default function RegistresLoading() {
  return (
    <div className="mx-auto max-w-6xl animate-pulse space-y-6">
      <div className="space-y-2">
        <div className="h-7 w-36 rounded-xl bg-stone-200" />
        <div className="h-4 w-full max-w-lg rounded-lg bg-stone-100" />
      </div>
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-9 w-24 rounded-xl bg-stone-100" />
        ))}
      </div>
      <div className="rounded-2xl border border-stone-100 bg-white shadow-sm">
        <div className="border-b border-stone-100 px-4 py-4 sm:px-6">
          <div className="h-4 w-40 rounded bg-stone-200" />
        </div>
        <div className="space-y-3 p-4 sm:p-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between gap-4">
              <div className="h-4 w-2/5 rounded bg-stone-100" />
              <div className="h-4 w-24 rounded bg-stone-100" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
