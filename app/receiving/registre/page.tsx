import Link from "next/link";
import { redirect } from "next/navigation";
import { Filter, ImageOff } from "lucide-react";
import { getRestaurantForPage } from "@/lib/auth";
import { getReceptionTraceabilityRegister } from "@/lib/db";
import { TRACEABILITY_ELEMENT_LABEL_FR, TRACEABILITY_ELEMENT_TYPES } from "@/lib/constants";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { SECTION_ACCENT } from "@/lib/ui/sectionAccents";
import { uiBtnPrimary, uiInput, uiLabel, uiSelect } from "@/components/ui/premium";

type Search = { [key: string]: string | string[] | undefined };

/** Date + heure déterministes (Europe/Paris) — rendu serveur stable. */
function fmtDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const date = d.toLocaleDateString("fr-FR", { timeZone: "Europe/Paris", day: "2-digit", month: "short", year: "numeric" });
  const time = d.toLocaleTimeString("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" });
  return `${date} · ${time}`;
}

function fmtDate(ymd: string | null): string {
  if (!ymd) return "—";
  const d = new Date(ymd + "T12:00:00");
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("fr-FR", { timeZone: "Europe/Paris", day: "2-digit", month: "short", year: "numeric" });
}

export default async function ReceptionTraceabilityRegisterPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const restaurant = await getRestaurantForPage();
  if (!restaurant) redirect("/onboarding");

  const sp = await searchParams;
  const fromDate = typeof sp.from === "string" ? sp.from : undefined;
  const toDate = typeof sp.to === "string" ? sp.to : undefined;
  const elementType = typeof sp.type === "string" ? sp.type : "all";
  const lotSearch = typeof sp.lot === "string" ? sp.lot : undefined;
  const hasFilters = Boolean(fromDate || toDate || (elementType && elementType !== "all") || lotSearch);

  const { data: rows, error } = await getReceptionTraceabilityRegister(restaurant.id, {
    fromDate,
    toDate,
    elementType: elementType === "all" ? undefined : elementType,
    lotSearch,
  });

  return (
    <PageContainer>
      <PageHeader
        accentIcon={SECTION_ACCENT.achats.icon}
        accentTone={SECTION_ACCENT.achats.tone}
        breadcrumbs={[
          { label: "Livraison", href: "/livraison" },
          { label: "Registre photos" },
        ]}
        title="Registre photos traçabilité"
        subtitle="Photos prises à la réception (par ligne de BL), filtrables par période, type d’élément et n° de lot."
      />

      <form
        method="get"
        className="flex flex-wrap items-end gap-3 rounded-2xl border border-stone-200/70 bg-white p-4 shadow-sm"
      >
        <div>
          <label htmlFor="reg-from" className={uiLabel}>Du</label>
          <input id="reg-from" name="from" type="date" defaultValue={fromDate ?? ""} className={`${uiInput} mt-1`} />
        </div>
        <div>
          <label htmlFor="reg-to" className={uiLabel}>Au</label>
          <input id="reg-to" name="to" type="date" defaultValue={toDate ?? ""} className={`${uiInput} mt-1`} />
        </div>
        <div>
          <label htmlFor="reg-type" className={uiLabel}>Type</label>
          <select id="reg-type" name="type" defaultValue={elementType} className={`${uiSelect} mt-1`}>
            <option value="all">Tous</option>
            {TRACEABILITY_ELEMENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {TRACEABILITY_ELEMENT_LABEL_FR[t]}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-[10rem] flex-1">
          <label htmlFor="reg-lot" className={uiLabel}>N° lot (contient)</label>
          <input
            id="reg-lot"
            name="lot"
            type="text"
            placeholder="ex. L2024"
            defaultValue={lotSearch ?? ""}
            className={`${uiInput} mt-1 w-full`}
          />
        </div>
        <button type="submit" className={`${uiBtnPrimary} inline-flex items-center gap-1.5`}>
          <Filter className="h-4 w-4" aria-hidden />
          Filtrer
        </button>
      </form>

      {error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-800">{error.message}</p>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={ImageOff}
          title="Aucune photo trouvée"
          description={
            hasFilters
              ? "Aucune photo ne correspond à ces critères. Élargissez la période ou réinitialisez les filtres."
              : "Les photos prises à la réception des livraisons apparaîtront ici, ligne de BL par ligne de BL."
          }
          action={
            hasFilters ? (
              <Link href="/receiving/registre" className={`${uiBtnPrimary} inline-flex items-center gap-1.5`}>
                Réinitialiser les filtres
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-stone-200/70 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead>
                <tr className="border-b border-stone-100 bg-stone-50/60 text-[11px] font-semibold uppercase tracking-wide text-stone-500">
                  <th className="px-3 py-2.5">Date / heure</th>
                  <th className="px-3 py-2.5">Type</th>
                  <th className="px-3 py-2.5">Fournisseur</th>
                  <th className="px-3 py-2.5">BL</th>
                  <th className="px-3 py-2.5">Ligne</th>
                  <th className="px-3 py-2.5">Produit stock</th>
                  <th className="px-3 py-2.5">N° lot</th>
                  <th className="px-3 py-2.5">DLC</th>
                  <th className="px-3 py-2.5">Photo</th>
                  <th className="px-3 py-2.5">Réception</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-stone-50 transition hover:bg-stone-50/70">
                    <td className="whitespace-nowrap px-3 py-2.5 text-stone-700">{fmtDateTime(r.created_at)}</td>
                    <td className="px-3 py-2.5 text-stone-700">
                      {TRACEABILITY_ELEMENT_TYPES.includes(r.element_type as (typeof TRACEABILITY_ELEMENT_TYPES)[number])
                        ? TRACEABILITY_ELEMENT_LABEL_FR[r.element_type as keyof typeof TRACEABILITY_ELEMENT_LABEL_FR]
                        : r.element_type}
                    </td>
                    <td className="px-3 py-2.5 text-stone-700">{r.supplier_name ?? "—"}</td>
                    <td className="px-3 py-2.5 text-stone-600">
                      {fmtDate(r.delivery_date)}
                      {r.bl_number ? ` · ${r.bl_number}` : ""}
                    </td>
                    <td className="max-w-[12rem] px-3 py-2.5 text-stone-700">{r.line_label}</td>
                    <td className="max-w-[12rem] px-3 py-2.5 text-stone-600">{r.product_name ?? "—"}</td>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      {r.lot_number ? (
                        <span className="rounded-md bg-copper-50 px-1.5 py-0.5 font-mono text-xs font-semibold text-copper-800">
                          {r.lot_number}
                        </span>
                      ) : (
                        <span className="text-stone-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-stone-700">{fmtDate(r.expiry_date)}</td>
                    <td className="px-3 py-2.5">
                      {r.file_url ? (
                        <a
                          href={r.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-block h-14 w-14 overflow-hidden rounded-lg border border-stone-200 bg-stone-100"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={r.file_url} alt="" className="h-full w-full object-cover" />
                        </a>
                      ) : (
                        <span className="text-stone-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <Link
                        href={`/receiving/${r.delivery_note_id}`}
                        className="font-medium text-copper-800 underline decoration-copper-300 underline-offset-2"
                      >
                        Ouvrir
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="border-t border-stone-100 px-3 py-2 text-xs text-stone-400">
            Affichage limité aux 500 entrées les plus récentes.
          </p>
        </div>
      )}
    </PageContainer>
  );
}
