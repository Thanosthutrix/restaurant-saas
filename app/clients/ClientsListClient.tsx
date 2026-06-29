"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { ArrowUpRight, Download, Plus, Search, UserRound, X } from "lucide-react";
import type { CustomerListSort, CustomerSource, CustomerTag, CustomerWithTags } from "@/lib/customers/types";
import { exportCustomersCsvAction } from "./actions";
import { CustomerNewClient } from "./new/CustomerNewClient";
import { uiBtnOutlineSm, uiBtnPrimary, uiBtnPrimarySm, uiInput } from "@/components/ui/premium";
import { EmptyState } from "@/components/ui/EmptyState";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

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
  const [showNew, setShowNew] = useState(false);

  useEffect(() => {
    if (!showNew) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowNew(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [showNew]);

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
    <div className="space-y-3">
      {/* Récap + actions */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 rounded-2xl border border-stone-200/70 bg-white p-4 shadow-sm">
        <div>
          <p className="text-xs font-medium text-stone-500">Fiches actives</p>
          <p className="text-3xl font-semibold tabular-nums tracking-tight text-stone-900">{totalActive}</p>
        </div>
        {totalApprox !== totalActive ? (
          <div className="border-l border-stone-100 pl-5">
            <p className="text-xs font-medium text-stone-500">Résultats filtrés</p>
            <p className="text-3xl font-semibold tabular-nums tracking-tight text-copper-800">{totalApprox}</p>
          </div>
        ) : null}
        <div className="ml-auto flex flex-wrap gap-2">
          <button type="button" disabled={exporting} onClick={downloadCsv} className={`${uiBtnOutlineSm} inline-flex items-center gap-1.5`}>
            <Download className="h-4 w-4" aria-hidden />
            {exporting ? "Export…" : "Exporter CSV"}
          </button>
          <button type="button" onClick={() => setShowNew(true)} className={`${uiBtnPrimary} inline-flex items-center gap-1.5`}>
            <Plus className="h-4 w-4" aria-hidden />
            Nouvelle fiche
          </button>
        </div>
      </div>

      {/* Filtres */}
      <form onSubmit={onFilterSubmit} className="space-y-4 rounded-2xl border border-stone-200/70 bg-white p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block text-xs font-medium text-stone-600 lg:col-span-2">
            Recherche
            <div className="relative mt-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" aria-hidden />
              <input
                name="q"
                type="search"
                defaultValue={initialQuery}
                placeholder="Nom, email, téléphone, ville…"
                className={`${uiInput} h-10 w-full pl-9`}
              />
            </div>
          </label>
          <label className="block text-xs font-medium text-stone-600">
            Tri
            <select name="sort" defaultValue={initialSort} className={`${uiInput} mt-1 h-10 w-full`}>
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-medium text-stone-600">
            Origine
            <select name="source" defaultValue={initialSource} className={`${uiInput} mt-1 h-10 w-full`}>
              {SOURCE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-stone-700">
              <input type="checkbox" name="marketing" defaultChecked={initialMarketingOnly} className="h-4 w-4 rounded border-stone-300" />
              Opt-in marketing
            </label>
            {tags.length > 0
              ? tags.map((t) => (
                  <label
                    key={t.id}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border bg-white px-2.5 py-1 text-xs font-medium"
                    style={{ borderColor: t.color }}
                  >
                    <input
                      type="checkbox"
                      name="tag"
                      value={t.id}
                      defaultChecked={initialTagIds.includes(t.id)}
                      className="h-3.5 w-3.5 rounded border-stone-300"
                    />
                    <span style={{ color: t.color }}>{t.label}</span>
                  </label>
                ))
              : null}
          </div>
          <button type="submit" className={uiBtnPrimarySm}>Appliquer</button>
        </div>
      </form>

      {/* Liste */}
      {initialRows.length === 0 ? (
        <EmptyState
          icon={UserRound}
          title="Aucun client"
          description="Aucune fiche ne correspond aux critères. Ajustez les filtres, ou créez une nouvelle fiche."
          action={
            <button type="button" onClick={() => setShowNew(true)} className={`${uiBtnPrimary} inline-flex items-center gap-1.5`}>
              <Plus className="h-4 w-4" aria-hidden />
              Nouvelle fiche
            </button>
          }
        />
      ) : (
        <ul className="space-y-2">
          {initialRows.map((row) => {
            const contact = [row.email, row.phone].filter(Boolean).join(" · ");
            return (
              <li key={row.id}>
                <Link
                  href={`/clients/${row.id}`}
                  className="group flex items-center gap-3 rounded-2xl border border-stone-200/70 bg-white px-3.5 py-3 shadow-sm transition hover:border-copper-200 hover:shadow-md"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-copper-50 text-sm font-bold text-copper-800 ring-1 ring-copper-100/90">
                    {initials(row.display_name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-2">
                      <span className="truncate font-semibold text-stone-900 transition group-hover:text-copper-700">
                        {row.display_name}
                      </span>
                      {row.company_name ? (
                        <span className="truncate text-xs text-stone-400">· {row.company_name}</span>
                      ) : null}
                    </span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
                      {contact ? <span className="truncate text-xs text-stone-500">{contact}</span> : null}
                      {row.tags.map((t) => (
                        <span
                          key={t.id}
                          className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
                          style={{ backgroundColor: t.color }}
                        >
                          {t.label}
                        </span>
                      ))}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end">
                    <span className="text-sm font-semibold tabular-nums text-stone-900">{row.visit_count}</span>
                    <span className="text-[10px] uppercase tracking-wide text-stone-400">visite{row.visit_count > 1 ? "s" : ""}</span>
                  </span>
                  <ArrowUpRight className="h-4 w-4 shrink-0 text-stone-300 transition group-hover:text-copper-600" aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {showNew ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-stone-900/40 p-4 backdrop-blur-sm sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Nouvelle fiche client"
          onClick={() => setShowNew(false)}
        >
          <div
            className="my-6 w-full max-w-2xl overflow-hidden rounded-2xl border border-stone-200/80 bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 flex items-center gap-3 border-b border-stone-100 bg-white/95 px-4 py-3 backdrop-blur-sm">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-copper-50 ring-1 ring-copper-100/90">
                <UserRound className="h-5 w-5 text-copper-700" aria-hidden />
              </span>
              <p className="text-sm font-semibold text-stone-900">Nouvelle fiche client</p>
              <button
                type="button"
                onClick={() => setShowNew(false)}
                className="ml-auto flex h-9 w-9 items-center justify-center rounded-lg text-stone-500 transition hover:bg-stone-100 hover:text-stone-800"
                aria-label="Fermer"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
            <div className="max-h-[78vh] overflow-y-auto bg-stone-50/50 px-4 py-4">
              <CustomerNewClient restaurantId={restaurantId} />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
