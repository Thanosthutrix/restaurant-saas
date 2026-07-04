import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { CheckCircle2 } from "lucide-react";

export type FocusItem = {
  tone: "copper" | "amber";
  icon: LucideIcon;
  count?: number;
  title: string;
  cta: string;
  href: string;
};

const TONES: Record<FocusItem["tone"], { square: string; ring: string; count: string; cta: string }> = {
  copper: {
    square: "bg-copper-50 text-copper-800",
    ring: "hover:border-copper-200",
    count: "text-copper-800",
    cta: "text-copper-700 group-hover:text-copper-600",
  },
  amber: {
    square: "bg-amber-50 text-amber-700",
    ring: "hover:border-amber-200",
    count: "text-amber-700",
    cta: "text-amber-800 group-hover:text-amber-700",
  },
};

/**
 * Bande « Maintenant » : la première chose vue le matin. Surface les seules
 * actions urgentes du jour. Si rien n'est en attente, état calme rassurant.
 */
export function DashboardFocusBand({ items }: { items: FocusItem[] }) {
  if (items.length === 0) {
    return (
      <section aria-label="À faire maintenant">
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-200/70 bg-emerald-50/60 px-4 py-3.5">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden />
          <p className="text-sm font-medium text-emerald-900">Tout est à jour pour aujourd’hui.</p>
        </div>
      </section>
    );
  }

  return (
    <section aria-label="À faire maintenant" className="space-y-2">
      <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-400">Maintenant</h2>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => {
          const Icon = item.icon;
          const tone = TONES[item.tone];
          return (
            <Link
              key={item.href + item.title}
              href={item.href}
              className={`group flex items-center gap-3.5 rounded-2xl border border-stone-100 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${tone.ring}`}
            >
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${tone.square}`}>
                <Icon className="h-5 w-5" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-1.5">
                  {item.count != null ? (
                    <span className={`text-2xl font-semibold tabular-nums leading-none ${tone.count}`}>
                      {item.count > 99 ? "99+" : item.count}
                    </span>
                  ) : null}
                  <p className="truncate text-sm font-semibold text-stone-900">{item.title}</p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
