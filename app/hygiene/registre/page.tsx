import Link from "next/link";
import { redirect } from "next/navigation";
import { getRestaurantForPage } from "@/lib/auth";
import { listHygieneRegister, getHygieneProofPublicUrl } from "@/lib/hygiene/hygieneDb";
import {
  HYGIENE_CATEGORY_LABEL_FR,
  HYGIENE_CLEANING_ACTION_LABEL_FR,
  HYGIENE_RISK_LABEL_FR,
  type HygieneCleaningActionType,
} from "@/lib/hygiene/types";
import { uiBackLink, uiLead, uiPageTitle } from "@/components/ui/premium";

export default async function HygieneRegistrePage() {
  const restaurant = await getRestaurantForPage();
  if (!restaurant) redirect("/onboarding");

  const rows = await listHygieneRegister(restaurant.id, 200);

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6">
      <div>
        <Link href="/hygiene" className={uiBackLink}>
          ← Nettoyage
        </Link>
        <h1 className={`mt-4 ${uiPageTitle}`}>Registre nettoyage</h1>
        <p className={`mt-2 ${uiLead}`}>
          Historique des validations : qui a fait quoi, quand, avec preuve photo le cas échéant.
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">Aucune tâche validée pour l’instant.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white shadow-sm">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2">Réalisé le</th>
                <th className="px-3 py-2">Élément</th>
                <th className="px-3 py-2">Criticité</th>
                <th className="px-3 py-2">Intervention</th>
                <th className="px-3 py-2">Par</th>
                <th className="px-3 py-2">Commentaire</th>
                <th className="px-3 py-2">Preuve</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const url = getHygieneProofPublicUrl(r.proof_photo_path);
                return (
                  <tr key={r.id} className="border-b border-slate-50">
                    <td className="px-3 py-2 whitespace-nowrap text-slate-700">
                      {r.completed_at
                        ? new Date(r.completed_at).toLocaleString("fr-FR", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <span className="font-medium text-slate-900">{r.element_name}</span>
                      <span className="block text-xs text-slate-500">
                        {HYGIENE_CATEGORY_LABEL_FR[r.element_category as keyof typeof HYGIENE_CATEGORY_LABEL_FR] ??
                          r.element_category}
                        {r.area_label ? ` · ${r.area_label}` : ""}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-700">{HYGIENE_RISK_LABEL_FR[r.risk_level]}</td>
                    <td className="px-3 py-2 text-slate-700">
                      {r.cleaning_action_type
                        ? HYGIENE_CLEANING_ACTION_LABEL_FR[r.cleaning_action_type as HygieneCleaningActionType]
                        : "—"}
                    </td>
                    <td className="px-3 py-2 text-slate-700">
                      <span className="font-medium">{r.completed_by_initials ?? "—"}</span>
                      {r.completed_by_display ? (
                        <span className="mt-0.5 block text-xs font-normal text-slate-500">
                          Compte : {r.completed_by_display}
                        </span>
                      ) : null}
                    </td>
                    <td className="max-w-[12rem] px-3 py-2 text-slate-600">{r.completion_comment ?? "—"}</td>
                    <td className="px-3 py-2">
                      {url ? (
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-block h-12 w-12 overflow-hidden rounded border border-slate-200 bg-slate-100"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={url} alt="" className="h-full w-full object-cover" />
                        </a>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
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
