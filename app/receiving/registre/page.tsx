import Link from "next/link";
import { redirect } from "next/navigation";
import { getRestaurantForPage } from "@/lib/auth";
import { getReceptionTraceabilityRegister } from "@/lib/db";
import { TRACEABILITY_ELEMENT_LABEL_FR, TRACEABILITY_ELEMENT_TYPES } from "@/lib/constants";

type Search = { [key: string]: string | string[] | undefined };

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

  const { data: rows, error } = await getReceptionTraceabilityRegister(restaurant.id, {
    fromDate,
    toDate,
    elementType: elementType === "all" ? undefined : elementType,
    lotSearch,
  });

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-4 flex flex-wrap gap-x-4 gap-y-1">
          <Link
            href="/livraison"
            className="text-slate-600 underline decoration-slate-400 underline-offset-2"
          >
            ← Livraison
          </Link>
        </div>

        <div className="mb-6 rounded-lg border border-slate-200 bg-white p-4">
          <h1 className="text-xl font-semibold text-slate-900">Registre photos traçabilité</h1>
          <p className="mt-1 text-sm text-slate-500">
            Photos prises à la réception (par ligne de BL), filtrables par période, type d’élément et n° de lot.
          </p>
        </div>

        <form
          method="get"
          className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4"
        >
          <div>
            <label htmlFor="reg-from" className="mb-1 block text-xs font-medium text-slate-500">
              Du
            </label>
            <input
              id="reg-from"
              name="from"
              type="date"
              defaultValue={fromDate ?? ""}
              className="rounded border border-slate-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label htmlFor="reg-to" className="mb-1 block text-xs font-medium text-slate-500">
              Au
            </label>
            <input
              id="reg-to"
              name="to"
              type="date"
              defaultValue={toDate ?? ""}
              className="rounded border border-slate-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label htmlFor="reg-type" className="mb-1 block text-xs font-medium text-slate-500">
              Type
            </label>
            <select
              id="reg-type"
              name="type"
              defaultValue={elementType}
              className="rounded border border-slate-300 px-2 py-1.5 text-sm"
            >
              <option value="all">Tous</option>
              {TRACEABILITY_ELEMENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {TRACEABILITY_ELEMENT_LABEL_FR[t]}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-[10rem] flex-1">
            <label htmlFor="reg-lot" className="mb-1 block text-xs font-medium text-slate-500">
              N° lot (contient)
            </label>
            <input
              id="reg-lot"
              name="lot"
              type="text"
              placeholder="ex. L2024"
              defaultValue={lotSearch ?? ""}
              className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
            />
          </div>
          <button
            type="submit"
            className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
          >
            Filtrer
          </button>
        </form>

        {error && (
          <p className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {error.message}
          </p>
        )}

        {!error && rows.length === 0 && (
          <p className="text-sm text-slate-600">Aucune photo enregistrée pour ces critères.</p>
        )}

        {!error && rows.length > 0 && (
          <div className="overflow-x-auto rounded border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="p-2">Date / heure</th>
                  <th className="p-2">Type</th>
                  <th className="p-2">Fournisseur</th>
                  <th className="p-2">BL</th>
                  <th className="p-2">Ligne</th>
                  <th className="p-2">Produit stock</th>
                  <th className="p-2">N° lot</th>
                  <th className="p-2">DLC</th>
                  <th className="p-2">Photo</th>
                  <th className="p-2">Réception</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100">
                    <td className="p-2 whitespace-nowrap text-slate-700">
                      {r.created_at
                        ? new Date(r.created_at).toLocaleString("fr-FR", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—"}
                    </td>
                    <td className="p-2 text-slate-700">
                      {TRACEABILITY_ELEMENT_TYPES.includes(
                        r.element_type as (typeof TRACEABILITY_ELEMENT_TYPES)[number]
                      )
                        ? TRACEABILITY_ELEMENT_LABEL_FR[
                            r.element_type as keyof typeof TRACEABILITY_ELEMENT_LABEL_FR
                          ]
                        : r.element_type}
                    </td>
                    <td className="p-2 text-slate-700">{r.supplier_name ?? "—"}</td>
                    <td className="p-2 text-slate-600">
                      {r.delivery_date
                        ? new Date(r.delivery_date + "T12:00:00").toLocaleDateString("fr-FR")
                        : "—"}
                      {r.bl_number ? ` · ${r.bl_number}` : ""}
                    </td>
                    <td className="p-2 max-w-[12rem] text-slate-700">{r.line_label}</td>
                    <td className="p-2 max-w-[12rem] text-slate-600">{r.product_name ?? "—"}</td>
                    <td className="p-2 font-mono text-xs text-slate-800">{r.lot_number ?? "—"}</td>
                    <td className="p-2 text-slate-700">
                      {r.expiry_date
                        ? new Date(r.expiry_date + "T12:00:00").toLocaleDateString("fr-FR")
                        : "—"}
                    </td>
                    <td className="p-2">
                      {r.file_url ? (
                        <a
                          href={r.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-block h-14 w-14 overflow-hidden rounded border border-slate-200 bg-slate-100"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={r.file_url} alt="" className="h-full w-full object-cover" />
                        </a>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="p-2">
                      <Link
                        href={`/receiving/${r.delivery_note_id}`}
                        className="text-indigo-700 underline decoration-indigo-300"
                      >
                        Ouvrir
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="border-t border-slate-100 px-3 py-2 text-xs text-slate-500">
              Affichage limité aux 500 entrées les plus récentes.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
