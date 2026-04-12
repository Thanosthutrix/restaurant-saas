import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentRestaurant } from "@/lib/auth";
import { listColdTemperatureRegister } from "@/lib/hygiene/hygieneDb";
import {
  HYGIENE_CATEGORY_LABEL_FR,
  HYGIENE_COLD_EVENT_LABEL_FR,
  type HygieneColdEventKind,
} from "@/lib/hygiene/types";
import { uiBackLink, uiLead, uiPageTitle } from "@/components/ui/premium";

export default async function HygieneRegistreTemperaturesPage() {
  const restaurant = await getCurrentRestaurant();
  if (!restaurant) redirect("/onboarding");

  const rows = await listColdTemperatureRegister(restaurant.id, 500);

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6">
      <div>
        <Link href="/hygiene/temperatures-ouverture" className={uiBackLink}>
          ← Relevés froid
        </Link>
        <h1 className={`mt-4 ${uiPageTitle}`}>Registre des températures</h1>
        <p className={`mt-2 ${uiLead}`}>
          Historique des relevés à l’ouverture et à la fermeture des équipements froids.
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">Aucun relevé enregistré pour l’instant.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white shadow-sm">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2">Date et heure</th>
                <th className="px-3 py-2">Équipement</th>
                <th className="px-3 py-2">Moment</th>
                <th className="px-3 py-2 text-right">Température</th>
                <th className="px-3 py-2">Par</th>
                <th className="px-3 py-2">Commentaire</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-slate-50">
                  <td className="px-3 py-2 whitespace-nowrap text-slate-700">
                    {new Date(r.recorded_at).toLocaleString("fr-FR", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="px-3 py-2">
                    <span className="font-medium text-slate-900">{r.element_name}</span>
                    <span className="block text-xs text-slate-500">
                      {HYGIENE_CATEGORY_LABEL_FR[r.element_category as keyof typeof HYGIENE_CATEGORY_LABEL_FR] ??
                        r.element_category}
                      {r.area_label ? ` · ${r.area_label}` : ""}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-slate-700">
                    {HYGIENE_COLD_EVENT_LABEL_FR[r.event_kind as HygieneColdEventKind]}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-900">
                    {r.temperature_celsius} °C
                  </td>
                  <td className="px-3 py-2 text-slate-700">
                    {r.recorded_by_initials ? (
                      <span className="font-medium">{r.recorded_by_initials}</span>
                    ) : null}
                    {r.recorded_by_display ? (
                      <span
                        className={`${r.recorded_by_initials ? "mt-0.5 block " : ""}text-xs text-slate-500`}
                      >
                        {r.recorded_by_initials ? "Compte : " : ""}
                        {r.recorded_by_display}
                      </span>
                    ) : null}
                    {!r.recorded_by_initials && !r.recorded_by_display ? "—" : null}
                  </td>
                  <td className="max-w-[14rem] px-3 py-2 text-slate-600">{r.comment ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className={`${uiLead} text-xs`}>
        Les indications du registre sont un support de traçabilité interne ; elles ne remplacent pas les obligations
        réglementaires applicables à votre établissement.
      </p>
    </div>
  );
}
