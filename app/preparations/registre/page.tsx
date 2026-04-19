import Link from "next/link";
import { redirect } from "next/navigation";
import { getRestaurantForPage } from "@/lib/auth";
import { listPreparationRegister } from "@/lib/preparations/preparationsDb";
import { uiBackLink, uiLead, uiPageTitle } from "@/components/ui/premium";

export default async function PreparationsRegistrePage() {
  const restaurant = await getRestaurantForPage();
  if (!restaurant) redirect("/onboarding");

  const rows = await listPreparationRegister(restaurant.id, 300);

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6">
      <div>
        <Link href="/preparations" className={uiBackLink}>
          ← Préparations
        </Link>
        <h1 className={`mt-4 ${uiPageTitle}`}>Registre des préparations</h1>
        <p className={`mt-2 ${uiLead}`}>
          Historique des lots : températures de fin, contrôle +2 h, DLC et auteur.
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">Aucune entrée pour l’instant.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white shadow-sm">
          <table className="w-full min-w-[1000px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2">Démarrage</th>
                <th className="px-3 py-2">N° lot</th>
                <th className="px-3 py-2">Libellé</th>
                <th className="px-3 py-2 text-right">T° fin</th>
                <th className="px-3 py-2">Heure fin</th>
                <th className="px-3 py-2 text-right">T° +2 h</th>
                <th className="px-3 py-2">Heure +2 h</th>
                <th className="px-3 py-2">DLC</th>
                <th className="px-3 py-2">Enregistré par</th>
                <th className="px-3 py-2">Commentaire</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-slate-50">
                  <td className="whitespace-nowrap px-3 py-2 text-slate-700">
                    {new Date(r.started_at).toLocaleString("fr-FR", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-slate-800">
                    {r.lot_reference ?? "—"}
                  </td>
                  <td className="px-3 py-2 font-medium text-slate-900">{r.label}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {r.temp_end_celsius != null ? `${r.temp_end_celsius} °C` : "—"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-slate-600">
                    {r.temp_end_recorded_at
                      ? new Date(r.temp_end_recorded_at).toLocaleString("fr-FR", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {r.temp_2h_celsius != null ? `${r.temp_2h_celsius} °C` : "—"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-slate-600">
                    {r.temp_2h_recorded_at
                      ? new Date(r.temp_2h_recorded_at).toLocaleString("fr-FR", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "—"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-slate-700">
                    {r.dlc_date
                      ? new Date(r.dlc_date + "T12:00:00").toLocaleDateString("fr-FR", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })
                      : "—"}
                  </td>
                  <td className="max-w-[10rem] px-3 py-2 text-xs text-slate-600">{r.recorded_by_display ?? "—"}</td>
                  <td className="max-w-[12rem] px-3 py-2 text-slate-600">{r.comment ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className={`${uiLead} text-xs`}>
        Traçabilité interne : les DLC et températures doivent être alignées avec votre méthode HACCP et les règles
        d’étiquetage en vigueur.
      </p>
    </div>
  );
}
