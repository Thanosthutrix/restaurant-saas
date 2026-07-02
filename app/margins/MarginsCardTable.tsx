"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronsUpDown, ChevronUp } from "lucide-react";
import type { MarginAnalysisRow } from "@/lib/margins/dishMarginAnalysis";
import { RateCell, fmtEur } from "./marginsUi";
import { uiTableLink } from "@/components/ui/premium";

const STATUS_LABELS: Record<string, string> = {
  validated: "Validée",
  draft: "Brouillon",
  missing: "Sans recette",
};

function formatVatPct(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${String(v).replace(".", ",")} %`;
}

type SortKey = "name" | "recipe" | "ttc" | "vat" | "food" | "ht" | "margin" | "pct";
type SortDir = "asc" | "desc";

function recipeLabel(r: MarginAnalysisRow): string {
  return r.recipeStatus ? STATUS_LABELS[r.recipeStatus] ?? r.recipeStatus : "";
}

/** Valeur numérique ou string selon la colonne ; null traité à part. */
function numValue(r: MarginAnalysisRow, key: SortKey): number | null {
  switch (key) {
    case "ttc":
      return r.sellingPriceTtc;
    case "vat":
      return r.sellingVatRatePct;
    case "food":
      return r.foodCostHt;
    case "ht":
      return r.sellingPriceHt;
    case "margin":
      return r.marginHt;
    case "pct":
      return r.marginPct;
    default:
      return null;
  }
}

function SortableTh({
  label,
  sortKey,
  align = "right",
  activeKey,
  dir,
  onToggle,
}: {
  label: string;
  sortKey: SortKey;
  align?: "left" | "right";
  activeKey: SortKey;
  dir: SortDir;
  onToggle: (k: SortKey) => void;
}) {
  const active = activeKey === sortKey;
  const Icon = !active ? ChevronsUpDown : dir === "asc" ? ChevronUp : ChevronDown;
  return (
    <th
      aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}
      className={`px-3 py-2.5 ${align === "right" ? "text-right" : "text-left"}`}
    >
      <button
        type="button"
        onClick={() => onToggle(sortKey)}
        className={`inline-flex items-center gap-1 transition hover:text-stone-800 ${
          align === "right" ? "flex-row-reverse" : ""
        } ${active ? "text-copper-700" : "text-stone-500"}`}
      >
        <span>{label}</span>
        <Icon className={`h-3.5 w-3.5 ${active ? "text-copper-600" : "text-stone-300"}`} aria-hidden />
      </button>
    </th>
  );
}

export function MarginsCardTable({ rows }: { rows: MarginAnalysisRow[] }) {
  const [key, setKey] = useState<SortKey>("pct");
  const [dir, setDir] = useState<SortDir>("desc");

  function toggle(next: SortKey) {
    if (next === key) {
      setDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setKey(next);
      // Texte → tri croissant par défaut ; chiffres → décroissant (plus parlant).
      setDir(next === "name" || next === "recipe" ? "asc" : "desc");
    }
  }

  const sorted = useMemo(() => {
    const sign = dir === "asc" ? 1 : -1;
    const byName = (a: MarginAnalysisRow, b: MarginAnalysisRow) => a.dishName.localeCompare(b.dishName, "fr");
    return [...rows].sort((a, b) => {
      if (key === "name") return a.dishName.localeCompare(b.dishName, "fr") * sign;
      if (key === "recipe") {
        const c = recipeLabel(a).localeCompare(recipeLabel(b), "fr") * sign;
        return c !== 0 ? c : byName(a, b);
      }
      const av = numValue(a, key);
      const bv = numValue(b, key);
      // Valeurs manquantes toujours en bas, quel que soit le sens.
      if (av == null && bv == null) return byName(a, b);
      if (av == null) return 1;
      if (bv == null) return -1;
      if (av === bv) return byName(a, b);
      return (av - bv) * sign;
    });
  }, [rows, key, dir]);

  const thProps = { activeKey: key, dir, onToggle: toggle };

  return (
    <div className="overflow-x-auto border-t border-stone-100">
      <table className="w-full min-w-[860px] text-left text-sm">
        <thead>
          <tr className="border-b border-stone-100 bg-stone-50/60 text-[11px] font-semibold uppercase tracking-wide">
            <SortableTh label="Plat" sortKey="name" align="left" {...thProps} />
            <SortableTh label="Recette" sortKey="recipe" align="left" {...thProps} />
            <SortableTh label="PV TTC" sortKey="ttc" {...thProps} />
            <SortableTh label="TVA" sortKey="vat" {...thProps} />
            <SortableTh label="Coût mat. HT" sortKey="food" {...thProps} />
            <SortableTh label="PV HT" sortKey="ht" {...thProps} />
            <SortableTh label="Marge HT" sortKey="margin" {...thProps} />
            <SortableTh label="Taux" sortKey="pct" {...thProps} />
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.dishId} className="border-b border-stone-50 transition hover:bg-stone-50/70">
              <td className="px-3 py-2.5 align-top">
                <Link href={`/dishes/${r.dishId}`} className={uiTableLink}>
                  {r.dishName}
                </Link>
                {r.note && <p className="mt-1 text-xs text-amber-700">{r.note}</p>}
              </td>
              <td className="px-3 py-2.5 align-top text-stone-600">
                {r.recipeStatus ? STATUS_LABELS[r.recipeStatus] ?? r.recipeStatus : "—"}
              </td>
              <td className="px-3 py-2.5 text-right align-top tabular-nums text-stone-800">
                {fmtEur(r.sellingPriceTtc)}
              </td>
              <td className="px-3 py-2.5 text-right align-top tabular-nums text-stone-600">
                {formatVatPct(r.sellingVatRatePct)}
              </td>
              <td className="px-3 py-2.5 text-right align-top tabular-nums text-stone-800">{fmtEur(r.foodCostHt)}</td>
              <td className="px-3 py-2.5 text-right align-top tabular-nums text-stone-800">
                {fmtEur(r.sellingPriceHt)}
              </td>
              <td className="px-3 py-2.5 text-right align-top tabular-nums text-stone-800">{fmtEur(r.marginHt)}</td>
              <td className="px-3 py-2.5 align-top">
                <RateCell pct={r.marginPct} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
