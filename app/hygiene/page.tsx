import Link from "next/link";
import { redirect } from "next/navigation";
import { getRestaurantForPage } from "@/lib/auth";
import {
  countHygieneTasksDue,
  getHygieneScoreForRestaurant,
  listHygieneTasksDue,
} from "@/lib/hygiene/hygieneDb";
import { cachedEnsureHygieneTasks } from "@/lib/cache";
import { uiCard, uiCardMuted, uiLead, uiSectionTitleSm } from "@/components/ui/premium";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";
import { SECTION_ACCENT } from "@/lib/ui/sectionAccents";

export default async function HygieneHubPage() {
  const restaurant = await getRestaurantForPage();
  if (!restaurant) redirect("/onboarding");

  await cachedEnsureHygieneTasks(restaurant.id);
  const [score, duePreview, dueCount] = await Promise.all([
    getHygieneScoreForRestaurant(restaurant.id, 7),
    listHygieneTasksDue(restaurant.id, 6),
    countHygieneTasksDue(restaurant.id),
  ]);

  return (
    <PageContainer width="narrow">
      <PageHeader
        accentIcon={SECTION_ACCENT.hygiene.icon}
        accentTone={SECTION_ACCENT.hygiene.tone}
        breadcrumbs={[{ label: "Tableau de bord", href: "/dashboard" }, { label: "Hygiène" }]}
        title="Nettoyage & désinfection"
        subtitle="Plan de nettoyage (PND) : éléments à nettoyer, tâches générées selon la récurrence, registre et score hygiène sur les 7 derniers jours."
      />

      <section className={`${uiCard} space-y-3`}>
        <h2 className={uiSectionTitleSm}>Score hygiène (7 j.)</h2>
        <div className="flex flex-wrap items-end gap-4">
          <p className="text-4xl font-bold tabular-nums text-copper-800">{score.score}</p>
          <span className="pb-1 text-sm text-stone-500">/ 100</span>
        </div>
        <p className={`${uiLead} text-xs leading-relaxed`}>{score.detail}</p>
        <p className="text-xs text-stone-400">
          Pondération : standard ×1, important ×2, critique ×4. À temps = 100 % du poids, en retard = 50 %, non
          réalisé = 0 %.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className={uiSectionTitleSm}>Raccourcis</h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          <li>
            <Link
              href="/hygiene/a-faire"
              className={`${uiCard} block font-medium text-copper-800 transition hover:border-copper-200 hover:shadow-md`}
            >
              À faire maintenant
              {dueCount > 0 && (
                <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">
                  {dueCount}
                </span>
              )}
            </Link>
          </li>
          <li>
            <Link
              href="/hygiene/elements"
              className={`${uiCard} block font-medium text-copper-800 transition hover:border-copper-200 hover:shadow-md`}
            >
              Éléments à nettoyer
            </Link>
          </li>
          <li>
            <Link
              href="/hygiene/registre"
              className={`${uiCard} block font-medium text-copper-800 transition hover:border-copper-200 hover:shadow-md`}
            >
              Registre nettoyage
            </Link>
          </li>
          <li>
            <Link
              href="/hygiene/haccp"
              className={`${uiCard} block font-medium text-copper-800 transition hover:border-copper-200 hover:shadow-md`}
            >
              Températures HACCP
            </Link>
          </li>
          <li>
            <Link
              href="/hygiene/temperatures-ouverture"
              className={`${uiCard} block font-medium text-copper-800 transition hover:border-copper-200 hover:shadow-md`}
            >
              Froid : ouverture / fermeture
            </Link>
          </li>
          <li>
            <Link
              href="/hygiene/registre-temperatures"
              className={`${uiCard} block font-medium text-copper-800 transition hover:border-copper-200 hover:shadow-md`}
            >
              Registre froid (ouverture)
            </Link>
          </li>
        </ul>
      </section>

      {duePreview.length > 0 && (
        <section className="space-y-2">
          <h2 className={uiSectionTitleSm}>Prochaines échéances (aperçu)</h2>
          <ul className="space-y-2">
            {duePreview.slice(0, 5).map((t) => (
              <li key={t.id} className={uiCardMuted}>
                <span className="font-medium text-stone-900">{t.element_name}</span>
                <span className="ml-2 text-xs text-stone-500">
                  {t.area_label ? `· ${t.area_label}` : ""} ·{" "}
                  {new Date(t.due_at).toLocaleString("fr-FR", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </PageContainer>
  );
}
