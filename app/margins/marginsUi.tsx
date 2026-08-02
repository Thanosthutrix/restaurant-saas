import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Trophy, TrendingDown, Info } from "lucide-react";
import type { MarginCostBasis } from "@/lib/margins/realizedServiceMargins";

/**
 * Palette « santé de marge » réutilisée partout sur la page Marges.
 * Seuils pensés pour la restauration (marge brute matière) :
 * ≥ 70 % excellente · 55-70 % correcte · < 55 % à surveiller.
 */
export type MarginTier = {
  key: "none" | "high" | "mid" | "low";
  label: string;
  chip: string;
  bar: string;
  text: string;
  ring: string;
};

export function marginTier(pct: number | null): MarginTier {
  if (pct == null || !Number.isFinite(pct)) {
    return { key: "none", label: "—", chip: "bg-stone-100 text-stone-500", bar: "bg-stone-300", text: "text-stone-500", ring: "#d6d3d1" };
  }
  if (pct >= 70) {
    return { key: "high", label: "Excellente", chip: "bg-emerald-100 text-emerald-800", bar: "bg-emerald-500", text: "text-emerald-700", ring: "#10b981" };
  }
  if (pct >= 55) {
    return { key: "mid", label: "Correcte", chip: "bg-amber-100 text-amber-900", bar: "bg-amber-500", text: "text-amber-700", ring: "#f59e0b" };
  }
  return { key: "low", label: "À surveiller", chip: "bg-rose-100 text-rose-800", bar: "bg-rose-500", text: "text-rose-700", ring: "#f43f5e" };
}

export function fmtEur(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

export function fmtPct(pct: number | null | undefined, digits = 1): string {
  if (pct == null || !Number.isFinite(pct)) return "—";
  return `${pct.toFixed(digits).replace(".", ",")} %`;
}

/** Pastille de taux colorée selon le tier. */
export function RateChip({ pct, className = "" }: { pct: number | null; className?: string }) {
  const t = marginTier(pct);
  return (
    <span className={`inline-flex items-center rounded-lg px-2 py-0.5 text-xs font-bold tabular-nums ${t.chip} ${className}`}>
      {fmtPct(pct)}
    </span>
  );
}

/** Barre horizontale de taux + valeur, pour les cellules de tableau. */
export function RateCell({ pct }: { pct: number | null }) {
  const t = marginTier(pct);
  const w = pct == null ? 0 : Math.max(0, Math.min(100, pct));
  return (
    <div className="flex items-center justify-end gap-2">
      <div className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-stone-100 sm:block">
        <div className={`h-full rounded-full ${t.bar}`} style={{ width: `${w}%` }} />
      </div>
      <span className={`w-14 text-right text-sm font-semibold tabular-nums ${t.text}`}>{fmtPct(pct)}</span>
    </div>
  );
}

/** Jauge donut : part de marge vs coût matière sur le CA (somme = 100 %). */
export function MarginDonut({ pct, size = 148 }: { pct: number | null; size?: number }) {
  const t = marginTier(pct);
  const r = 54;
  const c = 2 * Math.PI * r;
  const clamped = pct == null ? 0 : Math.max(0, Math.min(100, pct));
  const margeLen = (clamped / 100) * c;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 128 128" width={size} height={size} className="-rotate-90">
        <circle cx="64" cy="64" r={r} fill="none" stroke="#e7e5e4" strokeWidth="14" />
        {pct != null ? (
          <circle
            cx="64"
            cy="64"
            r={r}
            fill="none"
            stroke={t.ring}
            strokeWidth="14"
            strokeLinecap="round"
            strokeDasharray={`${margeLen} ${c - margeLen}`}
          />
        ) : null}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-2xl font-bold tabular-nums tracking-tight ${t.text}`}>
          {pct != null ? fmtPct(pct, 1) : "—"}
        </span>
        <span className="text-[11px] font-medium uppercase tracking-wide text-stone-400">marge</span>
      </div>
    </div>
  );
}

/** Carte chiffre clé premium. */
export function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  tone = "bg-stone-100 text-stone-700",
}: {
  label: string;
  value: string;
  sub?: string;
  icon: LucideIcon;
  tone?: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-stone-200/70 bg-white p-4 shadow-sm">
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tone}`}>
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium text-stone-500">{label}</p>
        <p className="mt-0.5 text-2xl font-semibold tabular-nums tracking-tight text-stone-900">{value}</p>
        {sub ? <p className="mt-0.5 truncate text-xs text-stone-400">{sub}</p> : null}
      </div>
    </div>
  );
}

export type LeaderItem = { id: string; name: string; pct: number | null; href: string; sub?: string };

/** Podium marge : champions (haut) ou à surveiller (bas). */
export function DishLeaderboard({
  variant,
  items,
}: {
  variant: "top" | "flop";
  items: LeaderItem[];
}) {
  const isTop = variant === "top";
  const Icon = isTop ? Trophy : TrendingDown;
  return (
    <div className="rounded-2xl border border-stone-200/70 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <span
          className={`flex h-8 w-8 items-center justify-center rounded-lg ${
            isTop ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
          }`}
        >
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        <div>
          <p className="text-sm font-semibold text-stone-900">{isTop ? "Vos champions" : "À surveiller"}</p>
          <p className="text-xs text-stone-400">{isTop ? "Meilleures marges" : "Marges les plus faibles"}</p>
        </div>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-stone-400">Pas assez de données.</p>
      ) : (
        <ol className="space-y-1.5">
          {items.map((it, i) => {
            const t = marginTier(it.pct);
            const w = it.pct == null ? 0 : Math.max(0, Math.min(100, it.pct));
            return (
              <li key={it.id}>
                <Link
                  href={it.href}
                  className="group flex items-center gap-3 rounded-xl px-2 py-1.5 transition hover:bg-stone-50"
                >
                  <span className="w-4 shrink-0 text-center text-xs font-bold tabular-nums text-stone-400">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-stone-800 group-hover:text-copper-700">
                      {it.name}
                    </span>
                    <span className="mt-1 flex h-1.5 w-full overflow-hidden rounded-full bg-stone-100">
                      <span className={`h-full rounded-full ${t.bar}`} style={{ width: `${w}%` }} />
                    </span>
                  </span>
                  <span className={`w-14 shrink-0 text-right text-sm font-bold tabular-nums ${t.text}`}>
                    {fmtPct(it.pct)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

/** Barre empilée « où part le CA » : marge (couleur tier) + coût matière. */
export function SplitBar({ revenue, cost }: { revenue: number; cost: number }) {
  const total = revenue > 0 ? revenue : cost > 0 ? cost : 1;
  const costPct = Math.max(0, Math.min(100, (cost / total) * 100));
  const margin = revenue - cost;
  const marginPct = Math.max(0, 100 - costPct);
  const t = marginTier(revenue > 0 ? (margin / revenue) * 100 : null);

  return (
    <div>
      <div className="flex h-4 w-full overflow-hidden rounded-full bg-stone-100">
        <div className={`${t.bar} h-full`} style={{ width: `${marginPct}%` }} title="Marge" />
        <div className="h-full bg-stone-300" style={{ width: `${costPct}%` }} title="Coût matière" />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <span className="flex items-center gap-1.5">
          <span className={`h-2.5 w-2.5 rounded-full ${t.bar}`} />
          <span className="font-medium text-stone-700">Marge</span>
          <span className="tabular-nums text-stone-500">{fmtEur(margin)}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-stone-300" />
          <span className="font-medium text-stone-700">Coût matière</span>
          <span className="tabular-nums text-stone-500">{fmtEur(cost)}</span>
        </span>
      </div>
    </div>
  );
}

/**
 * Pastille d'origine du coût matière. Une marge calculée sans facture d'achat
 * reste utile, à condition de dire qu'elle repose sur les recettes et non sur
 * des achats constatés.
 */
export function CostBasisBadge({
  basis,
  className = "",
}: {
  basis: MarginCostBasis;
  className?: string;
}) {
  if (basis === "invoiced") return null;
  const estimated = basis === "estimated";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${
        estimated ? "bg-sky-100 text-sky-800" : "bg-amber-100 text-amber-900"
      } ${className}`}
      title={
        estimated
          ? "Coût matière estimé d'après les recettes : aucune facture d'achat n'est rattachée à ces ventes."
          : "Une partie des sorties de stock n'a pas de facture à l'appui : le coût est complété par les recettes."
      }
    >
      <Info className="h-3 w-3" aria-hidden />
      {estimated ? "Estimé" : "Partiel"}
    </span>
  );
}

/** Bandeau d'explication affiché dès qu'une partie des coûts est estimée. */
export function EstimatedCostNotice({ count, total }: { count: number; total: number }) {
  if (count <= 0) return null;
  const all = count >= total;
  return (
    <p className="mb-3 flex items-start gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900">
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
      <span>
        {all
          ? "Marge estimée à partir des recettes : aucune facture d'achat n'est encore rattachée à ces ventes."
          : `Marge partiellement estimée : ${count} ligne${count > 1 ? "s" : ""} sur ${total} n'${count > 1 ? "ont" : "a"} pas de facture d'achat à l'appui.`}{" "}
        Enregistrez vos bons de livraison et factures fournisseurs pour obtenir le coût réellement payé.
      </span>
    </p>
  );
}
