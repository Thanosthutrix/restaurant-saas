import { redirect } from "next/navigation";
import { CalendarCheck, Camera, ClipboardCheck, Sparkles } from "lucide-react";
import { getRestaurantForPage } from "@/lib/auth";
import { listHygieneRegister, getHygieneProofPublicUrl } from "@/lib/hygiene/hygieneDb";
import {
  HYGIENE_CATEGORY_LABEL_FR,
  HYGIENE_CLEANING_ACTION_LABEL_FR,
  type HygieneCleaningActionType,
} from "@/lib/hygiene/types";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { SECTION_ACCENT } from "@/lib/ui/sectionAccents";
import { RiskPill } from "../hygieneUi";

/** Date + heure déterministes (Europe/Paris) — rendu serveur stable. */
function fmtDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const date = d.toLocaleDateString("fr-FR", { timeZone: "Europe/Paris", day: "2-digit", month: "short", year: "numeric" });
  const time = d.toLocaleTimeString("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" });
  return `${date} · ${time}`;
}

/** Instant courant (isolé dans un helper : requête serveur dynamique, pas de rendu figé). */
function currentMs(): number {
  return Date.now();
}

export default async function HygieneRegistrePage() {
  const restaurant = await getRestaurantForPage();
  if (!restaurant) redirect("/onboarding");

  const rows = await listHygieneRegister(restaurant.id, 200);

  const total = rows.length;
  const weekAgo = currentMs() - 7 * 24 * 60 * 60 * 1000;
  const last7d = rows.filter((r) => r.completed_at && new Date(r.completed_at).getTime() >= weekAgo).length;
  const withPhoto = rows.filter((r) => r.proof_photo_path).length;

  const stats: { label: string; value: number; icon: typeof ClipboardCheck; tone: string }[] = [
    { label: "Interventions enregistrées", value: total, icon: ClipboardCheck, tone: "bg-cyan-50 text-cyan-700" },
    { label: "Sur les 7 derniers jours", value: last7d, icon: CalendarCheck, tone: "bg-emerald-50 text-emerald-700" },
    { label: "Avec preuve photo", value: withPhoto, icon: Camera, tone: "bg-violet-50 text-violet-700" },
  ];

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
        subtitle="Historique des validations : qui a fait quoi, quand, avec preuve photo le cas échéant. Conservez-le comme preuve de traçabilité."
      />

      {total > 0 ? (
        <section className="grid grid-cols-3 gap-3" aria-label="Synthèse">
          {stats.map((s) => {
            const Icon = s.icon;
            return (
              <div
                key={s.label}
                className="flex items-center gap-3 rounded-2xl border border-stone-200/70 bg-white p-3 shadow-sm sm:p-4"
              >
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${s.tone}`}>
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="text-2xl font-semibold tabular-nums leading-none tracking-tight text-stone-900">
                    {s.value}
                  </p>
                  <p className="mt-1 text-xs font-medium text-stone-500">{s.label}</p>
                </div>
              </div>
            );
          })}
        </section>
      ) : null}

      {total === 0 ? (
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
                      <td className="px-3 py-2.5">
                        <RiskPill level={r.risk_level} />
                      </td>
                      <td className="px-3 py-2.5">
                        {r.cleaning_action_type ? (
                          <span className="inline-flex items-center rounded-md bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-700">
                            {HYGIENE_CLEANING_ACTION_LABEL_FR[r.cleaning_action_type as HygieneCleaningActionType]}
                          </span>
                        ) : (
                          <span className="text-stone-400">—</span>
                        )}
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
