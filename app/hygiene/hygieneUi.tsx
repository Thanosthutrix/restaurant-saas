import type { LucideIcon } from "lucide-react";
import { HYGIENE_RISK_LABEL_FR, type HygieneRiskLevel } from "@/lib/hygiene/types";

export type ScoreBand = {
  key: "none" | "high" | "mid" | "low";
  label: string;
  chip: string;
  text: string;
  ring: string;
};

export function scoreBand(score: number, hasData: boolean): ScoreBand {
  if (!hasData) {
    return { key: "none", label: "Pas encore de données", chip: "bg-stone-100 text-stone-500", text: "text-stone-500", ring: "#d6d3d1" };
  }
  if (score >= 85) {
    return { key: "high", label: "Impeccable", chip: "bg-emerald-100 text-emerald-800", text: "text-emerald-700", ring: "#10b981" };
  }
  if (score >= 60) {
    return { key: "mid", label: "Bon, peut mieux faire", chip: "bg-amber-100 text-amber-900", text: "text-amber-700", ring: "#f59e0b" };
  }
  return { key: "low", label: "À reprendre en main", chip: "bg-rose-100 text-rose-800", text: "text-rose-700", ring: "#f43f5e" };
}

/** Jauge circulaire du score hygiène /100. */
export function ScoreGauge({ score, hasData, size = 160 }: { score: number; hasData: boolean; size?: number }) {
  const band = scoreBand(score, hasData);
  const r = 54;
  const c = 2 * Math.PI * r;
  const val = hasData ? Math.max(0, Math.min(100, score)) : 0;
  const len = (val / 100) * c;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 128 128" width={size} height={size} className="-rotate-90">
        <circle cx="64" cy="64" r={r} fill="none" stroke="#e7e5e4" strokeWidth="13" />
        {hasData ? (
          <circle
            cx="64"
            cy="64"
            r={r}
            fill="none"
            stroke={band.ring}
            strokeWidth="13"
            strokeLinecap="round"
            strokeDasharray={`${len} ${c - len}`}
          />
        ) : null}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-4xl font-bold tabular-nums tracking-tight ${band.text}`}>
          {hasData ? score : "—"}
        </span>
        <span className="text-[11px] font-medium uppercase tracking-wide text-stone-400">/ 100</span>
      </div>
    </div>
  );
}

const RISK_PILL: Record<HygieneRiskLevel, string> = {
  critical: "bg-rose-100 text-rose-800",
  important: "bg-amber-100 text-amber-900",
  standard: "bg-stone-100 text-stone-600",
};

export function RiskPill({ level }: { level: HygieneRiskLevel }) {
  return (
    <span className={`inline-flex shrink-0 items-center rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${RISK_PILL[level]}`}>
      {HYGIENE_RISK_LABEL_FR[level]}
    </span>
  );
}

/** Petite carte chiffre clé (hub hygiène). */
export function StatTile({
  label,
  value,
  icon: Icon,
  tone,
  emphasis = false,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  tone: string;
  /** Met en avant (fond teinté) quand la valeur mérite l'attention. */
  emphasis?: boolean;
}) {
  return (
    <div
      className={`flex items-start gap-3 rounded-2xl border p-4 shadow-sm ${
        emphasis ? "border-rose-200 bg-rose-50/60" : "border-stone-200/70 bg-white"
      }`}
    >
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tone}`}>
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium text-stone-500">{label}</p>
        <p className="mt-0.5 text-2xl font-semibold tabular-nums tracking-tight text-stone-900">{value}</p>
      </div>
    </div>
  );
}

/** Date/heure d'échéance (Europe/Paris) + indication « en retard » / « dans X ». */
export function fmtWhen(iso: string, nowMs: number): { abs: string; hint: string; overdue: boolean } {
  const d = new Date(iso);
  const abs = `${d.toLocaleDateString("fr-FR", {
    timeZone: "Europe/Paris",
    weekday: "short",
    day: "2-digit",
    month: "short",
  })} · ${d.toLocaleTimeString("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" })}`;

  const diffMin = Math.round((d.getTime() - nowMs) / 60000);
  const overdue = diffMin < 0;
  const mag = Math.abs(diffMin);
  let rel: string;
  if (mag < 60) rel = `${mag} min`;
  else if (mag < 60 * 24) rel = `${Math.round(mag / 60)} h`;
  else rel = `${Math.round(mag / (60 * 24))} j`;
  const hint = overdue ? `en retard de ${rel}` : `dans ${rel}`;
  return { abs, hint, overdue };
}
