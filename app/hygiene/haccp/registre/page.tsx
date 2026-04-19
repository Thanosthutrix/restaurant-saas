import Link from "next/link";
import { redirect } from "next/navigation";
import { getRestaurantForPage } from "@/lib/auth";
import { listTemperatureLogs, type TemperatureLogFilter } from "@/lib/haccpTemperature/haccpTemperatureDb";
import {
  TEMPERATURE_LOG_STATUS_LABEL_FR,
  TEMPERATURE_POINT_TYPE_LABEL_FR,
  type TemperatureLogStatus,
} from "@/lib/haccpTemperature/types";
import { uiBackLink, uiLead, uiPageTitle } from "@/components/ui/premium";

type Search = { filter?: string };

export default async function HaccpRegistrePage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const restaurant = await getRestaurantForPage();
  if (!restaurant) redirect("/onboarding");

  const sp = await searchParams;
  const filter: TemperatureLogFilter = sp.filter === "anomalies" ? "anomalies" : "all";
  const rows = await listTemperatureLogs(restaurant.id, { limit: 400, filter });

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6">
      <div>
        <Link href="/hygiene/haccp" className={uiBackLink}>
          ← Températures HACCP
        </Link>
        <h1 className={`mt-4 ${uiPageTitle}`}>Registre des relevés</h1>
        <p className={`mt-2 ${uiLead}`}>Historique des mesures et traitement des anomalies.</p>
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        <Link
          href="/hygiene/haccp/registre"
          className={
            filter === "all"
              ? "rounded-full bg-slate-900 px-3 py-1 font-medium text-white"
              : "rounded-full border border-slate-200 px-3 py-1 text-slate-700 hover:bg-slate-50"
          }
        >
          Tous
        </Link>
        <Link
          href="/hygiene/haccp/registre?filter=anomalies"
          className={
            filter === "anomalies"
              ? "rounded-full bg-amber-700 px-3 py-1 font-medium text-white"
              : "rounded-full border border-slate-200 px-3 py-1 text-slate-700 hover:bg-slate-50"
          }
        >
          Anomalies seulement
        </Link>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">Aucun relevé enregistré.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white shadow-sm">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Point</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2 text-right">Mesure</th>
                <th className="px-3 py-2">Statut</th>
                <th className="px-3 py-2">Par</th>
                <th className="px-3 py-2">Commentaire / action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-slate-50">
                  <td className="whitespace-nowrap px-3 py-2 text-slate-700">
                    {new Date(r.created_at).toLocaleString("fr-FR", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="px-3 py-2 font-medium text-slate-900">{r.point_name}</td>
                  <td className="px-3 py-2 text-slate-600">
                    {TEMPERATURE_POINT_TYPE_LABEL_FR[r.point_type]}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-900">{r.value} °C</td>
                  <td className="px-3 py-2">
                    <span
                      className={
                        r.log_status === "critical"
                          ? "font-medium text-rose-800"
                          : r.log_status === "alert"
                            ? "font-medium text-amber-800"
                            : "text-slate-700"
                      }
                    >
                      {TEMPERATURE_LOG_STATUS_LABEL_FR[r.log_status as TemperatureLogStatus]}
                    </span>
                  </td>
                  <td className="max-w-[10rem] px-3 py-2 text-xs text-slate-600">
                    {r.recorded_by_display ?? "—"}
                  </td>
                  <td className="max-w-[18rem] px-3 py-2 text-slate-600">
                    {r.comment && <p>{r.comment}</p>}
                    {r.corrective_action && (
                      <p className="text-xs text-slate-500">
                        <span className="font-medium text-slate-600">Action : </span>
                        {r.corrective_action}
                      </p>
                    )}
                    {r.product_impact && (
                      <p className="text-xs text-slate-500">Produit : {r.product_impact}</p>
                    )}
                    {!r.comment && !r.corrective_action && !r.product_impact ? "—" : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className={`${uiLead} text-xs`}>
        Support de traçabilité interne ; adaptez les procédures à votre établissement et aux exigences du contrôle
        sanitaire.
      </p>
    </div>
  );
}
