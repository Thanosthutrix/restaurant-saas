/** Skeleton réutilisable pour les pages en chargement. */
export function PageSkeleton({
  titleWidth = "w-48",
  lines = 4,
}: {
  titleWidth?: string;
  lines?: number;
}) {
  return (
    <div className="mx-auto max-w-2xl animate-pulse space-y-6 px-4 py-6">
      <div>
        <div className={`h-7 ${titleWidth} rounded-xl bg-stone-200`} />
        <div className="mt-2 h-4 w-full max-w-md rounded-lg bg-stone-100" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: lines }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-stone-100 bg-white p-4 shadow-sm">
            <div className="h-4 w-1/2 rounded bg-stone-200" />
            <div className="mt-2 h-3 w-1/3 rounded bg-stone-100" />
          </div>
        ))}
      </div>
    </div>
  );
}
