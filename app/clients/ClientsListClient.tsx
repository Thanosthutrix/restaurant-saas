"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import type { CustomerListSort, CustomerSource, CustomerTag, CustomerWithTags } from "@/lib/customers/types";
import { exportCustomersCsvAction } from "./actions";
import { uiBtnOutlineSm, uiBtnPrimarySm, uiCard } from "@/components/ui/premium";

const SORT_OPTIONS: { value: CustomerListSort; label: string }[] = [
  { value: "name_asc", label: "Nom A → Z" },
  { value: "created_desc", label: "Création (récent)" },
  { value: "last_visit_desc", label: "Dernière visite" },
  { value: "visits_desc", label: "Nombre de visites" },
];

const SOURCE_OPTIONS: { value: "all" | CustomerSource; label: string }[] = [
  { value: "all", label: "Toutes origines" },
  { value: "walk_in", label: "Passage" },
  { value: "phone", label: "Téléphone" },
  { value: "website", label: "Site / web" },
  { value: "referral", label: "Recommandation" },
  { value: "social", label: "Réseaux sociaux" },
  { value: "event", label: "Événement" },
  { value: "import", label: "Import" },
  { value: "other", label: "Autre" },
];

type Props = {
  restaurantId: string;
  initialRows: CustomerWithTags[];
  totalApprox: number;
  totalActive: number;
  tags: CustomerTag[];
  initialQuery: string;
  initialSort: CustomerListSort;
  initialTagIds: string[];
  initialSource: "all" | CustomerSource;
  initialMarketingOnly: boolean;
};

export function ClientsListClient({
  restaurantId,
  initialRows,
  totalApprox,
  totalActive,
  tags,
  initialQuery,
  initialSort,
  initialTagIds,
  initialSource,
  initialMarketingOnly,
}: Props) {
  const router = useRouter();
  const [exporting, startExport] = useTransition();

  function buildQueryString(form: FormData): string {
    const q = String(form.get("q") ?? "").trim();
    const sort = String(form.get("sort") ?? "name_asc");
    const source = String(form.get("source") ?? "all");
    const marketing = form.get("marketing") === "on" ? "1" : "";
    const selectedTags = form.getAll("tag") as string[];
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (sort && sort !== "name_asc") p.set("sort", sort);
    if (source && source !== "all") p.set("source", source);
    if (marketing) p.set("marketing", marketing);
    if (selectedTags.length) p.set("tag", selectedTags.join(","));
    const s = p.toString();
    return s ? `?${s}` : "";
  }

  function onFilterSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    router.push(`/clients${buildQueryString(fd)}`);
  }

  function downloadCsv() {
    startExport(async () => {
      const r = await exportCustomersCsvAction(restaurantId);
      if (!r.ok) return;
      const blob = new Blob(["\ufeff", r.csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = r.filename;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600">
          <span className="font-semibold text-slate-900 tabular-nums">{totalActive}</span> fiche
          {totalActive > 1 ? "s" : ""} active{totalActive > 1 ? "s" : ""}
          {totalApprox !== totalActive ? (
            <span className="text-slate-400"> · {totalApprox} résultat(s) filtré(s)</span>
          ) : null}
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={exporting}
            onClick={downloadCsv}
            className={uiBtnOutlineSm}
          >
            {exporting ? "Export…" : "Exporter CSV"}
          </button>
          <Link href="/clients/new" className={uiBtnPrimarySm}>
            Nouvelle fiche
          </Link>
        </div>
      </div>

      <form onSubmit={onFilterSubmit} className={`${uiCard} space-y-4`}>
        <p className="text-sm font-semibold text-slate-800">Filtres</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block text-xs font-medium text-slate-600">
            Recherche
            <input
              name="q"
              type="search"
              defaultValue={initialQuery}
              placeholder="Nom, email, téléphone, ville…"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-xs font-medium text-slate-600">
            Tri
            <select
              name="sort"
              defaultValue={initialSort}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-medium text-slate-600">
            Origine
            <select
              name="source"
              defaultValue={initialSource}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              {SOURCE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex cursor-pointer items-end gap-2 pb-2 text-sm text-slate-700">
            <input
              type="checkbox"
              name="marketing"
              defaultChecked={initialMarketingOnly}
              className="h-4 w-4 rounded border-slate-300"
            />
            Opt-in marketing
          </label>
        </div>

        {tags.length > 0 ? (
          <fieldset>
            <legend className="text-xs font-medium text-slate-600">Étiquettes (toutes requises)</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {tags.map((t) => (
                <label
                  key={t.id}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium"
                  style={{ borderColor: t.color }}
                >
                  <input
                    type="checkbox"
                    name="tag"
                    value={t.id}
                    defaultChecked={initialTagIds.includes(t.id)}
                    className="h-3.5 w-3.5 rounded border-slate-300"
                  />
                  <span style={{ color: t.color }}>{t.label}</span>
                </label>
              ))}
            </div>
          </fieldset>
        ) : (
          <p className="text-xs text-slate-500">Aucune étiquette : créez-en depuis une fiche client ou les réglages futurs.</p>
        )}

        <button type="submit" className={uiBtnPrimarySm}>
          Appliquer
        </button>
      </form>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/90 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3">Client</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">Étiquettes</th>
              <th className="px-4 py-3 text-right">Visites</th>
              <th className="w-10 px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {initialRows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  Aucun client ne correspond aux critères.
                </td>
              </tr>
            ) : (
              initialRows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50/80">
                  <td className="px-4 py-3">
                    <Link href={`/clients/${row.id}`} className="font-medium text-indigo-700 hover:underline">
                      {row.display_name}
                    </Link>
                    {row.company_name ? (
                      <div className="text-xs text-slate-500">{row.company_name}</div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    <div>{row.email ?? "—"}</div>
                    <div className="tabular-nums">{row.phone ?? ""}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {row.tags.length === 0 ? (
                        <span className="text-slate-400">—</span>
                      ) : (
                        row.tags.map((t) => (
                          <span
                            key={t.id}
                            className="rounded-full px-2 py-0.5 text-[11px] font-semibold text-white"
                            style={{ backgroundColor: t.color }}
                          >
                            {t.label}
                          </span>
                        ))
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-800">{row.visit_count}</td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/clients/${row.id}`}
                      className="text-indigo-600 hover:text-indigo-500"
                      aria-label={`Ouvrir ${row.display_name}`}
                    >
                      →
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
