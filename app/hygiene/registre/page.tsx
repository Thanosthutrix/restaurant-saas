import { redirect } from "next/navigation";
import { Sparkles } from "lucide-react";
import { getRestaurantForPage } from "@/lib/auth";
import { listHygieneRegister, getHygieneProofPublicUrl } from "@/lib/hygiene/hygieneDb";
import {
  HYGIENE_CATEGORY_LABEL_FR,
  HYGIENE_CLEANING_ACTION_LABEL_FR,
  HYGIENE_RISK_LABEL_FR,
  type HygieneCleaningActionType,
} from "@/lib/hygiene/types";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { SECTION_ACCENT } from "@/lib/ui/sectionAccents";

/** Date + heure déterministes (Europe/Paris) — rendu serveur stable. */
function fmtDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const date = d.toLocaleDateString("fr-FR", { timeZone: "Europe/Paris", day: "2-digit", month: "short", year: "numeric" });
  const time = d.toLocaleTimeString("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" });
  return `${date} · ${time}`;
}

export default async function HygieneRegistrePage() {
  const restaurant = await getRestaurantForPage();
  if (!restaurant) redirect("/onboarding");

  const rows = await listHygieneRegister(restaurant.id, 200);

  return (
    <PageContainer>
      <PageHeader
        accentIcon={SECTION_ACCENT.hygiene.icon}
        accentTone={SECTION_ACCENT.hygiene.tone}
        breadcrumbs={[
          { label: "Cuisine", href: "/cuisine" },
          { label: "Nettoyage", href: "/hygiene" },
          { label: "Registre" },
        ]}
        title="Registre nettoyage"
        subtitle="Historique des validations : qui a fait quoi, quand, avec preuve photo le cas échéant."
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="Aucune tâche validée"
          description="Les validations de nettoyage apparaîtront ici au fur et à mesure, avec leur preuve photo éventuelle."
          actionLabel="Aller au nettoyage"
          actionHref="/hygiene"
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-stone-200/70 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="border-b border-stone-100 bg-stone-50/60 text-[11px] font-semibold uppercase tracking-wide text-stone-500">
                  <th className="px-3 py-2.5">Réalisé le</th>
                  <th className="px-3 py-2.5">Élément</th>
                  <th className="px-3 py-2.5">Criticité</th>
                  <th className="px-3 py-2.5">Intervention</th>
                  <th className="px-3 py-2.5">Par</th>
                  <th className="px-3 py-2.5">Commentaire</th>
                  <th className="px-3 py-2.5">Preuve</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const url = getHygieneProofPublicUrl(r.proof_photo_path);
                  return (
                    <tr key={r.id} className="border-b border-stone-50 transition hover:bg-stone-50/70">
                      <td className="whitespace-nowrap px-3 py-2.5 text-stone-700">{fmtDateTime(r.completed_at)}</td>
                      <td className="px-3 py-2.5">
                        <span className="font-medium text-stone-900">{r.element_name}</span>
                        <span className="block text-xs text-stone-500">
                          {HYGIENE_CATEGORY_LABEL_FR[r.element_category as keyof typeof HYGIENE_CATEGORY_LABEL_FR] ??
                            r.element_category}
                          {r.area_label ? ` · ${r.area_label}` : ""}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-stone-700">{HYGIENE_RISK_LABEL_FR[r.risk_level]}</td>
                      <td className="px-3 py-2.5 text-stone-700">
                        {r.cleaning_action_type
                          ? HYGIENE_CLEANING_ACTION_LABEL_FR[r.cleaning_action_type as HygieneCleaningActionType]
                          : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-stone-700">
                        <span className="font-medium">{r.completed_by_initials ?? "—"}</span>
                        {r.completed_by_display ? (
                          <span className="mt-0.5 block text-xs font-normal text-stone-500">
                            Compte : {r.completed_by_display}
                          </span>
                        ) : null}
                      </td>
                      <td className="max-w-[12rem] px-3 py-2.5 text-stone-600">{r.completion_comment ?? "—"}</td>
                      <td className="px-3 py-2.5">
                        {url ? (
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-block h-12 w-12 overflow-hidden rounded-lg border border-stone-200 bg-stone-100"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={url} alt="" className="h-full w-full object-cover" />
                          </a>
                        ) : (
                          <span className="text-stone-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="text-xs leading-relaxed text-stone-400">
        Les indications du registre sont un support de traçabilité interne ; elles ne remplacent pas les obligations
        réglementaires applicables à votre établissement.
      </p>
    </PageContainer>
  );
}
