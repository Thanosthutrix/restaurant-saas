import Link from "next/link";
import { redirect } from "next/navigation";
import { getRestaurantForPage } from "@/lib/auth";
import {
  countHygieneTasksDue,
  ensureHygieneTasksForRestaurant,
  getHygieneScoreForRestaurant,
  listHygieneTasksDue,
} from "@/lib/hygiene/hygieneDb";
import { uiBackLink, uiCard, uiCardMuted, uiLead, uiPageTitle, uiSectionTitleSm } from "@/components/ui/premium";

export default async function HygieneHubPage() {
  const restaurant = await getRestaurantForPage();
  if (!restaurant) redirect("/onboarding");

  await ensureHygieneTasksForRestaurant(restaurant.id, 14);
  const [score, duePreview, dueCount] = await Promise.all([
    getHygieneScoreForRestaurant(restaurant.id, 7),
    listHygieneTasksDue(restaurant.id, 6),
    countHygieneTasksDue(restaurant.id),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-8 px-4 py-6">
      <div>
        <Link href="/dashboard" className={uiBackLink}>
          ← Tableau de bord
        </Link>
        <h1 className={`mt-4 ${uiPageTitle}`}>Nettoyage & désinfection</h1>
        <p className={`mt-2 ${uiLead}`}>
          Plan de nettoyage (PND) : éléments à nettoyer, tâches générées selon la récurrence, registre et score
          hygiène sur 7 jours glissants (indicateur interne, non normatif).
        </p>
      </div>

      <section className={`${uiCard} space-y-3`}>
        <h2 className={uiSectionTitleSm}>Score hygiène (7 j.)</h2>
        <div className="flex flex-wrap items-end gap-4">
          <p className="text-4xl font-bold tabular-nums text-indigo-700">{score.score}</p>
          <span className="pb-1 text-sm text-slate-500">/ 100</span>
        </div>
        <p className={`${uiLead} text-xs leading-relaxed`}>{score.detail}</p>
        <p className="text-xs text-slate-400">
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
              className={`${uiCard} block font-medium text-indigo-700 transition hover:border-indigo-200 hover:shadow-md`}
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
              className={`${uiCard} block font-medium text-indigo-700 transition hover:border-indigo-200 hover:shadow-md`}
            >
              Éléments à nettoyer
            </Link>
          </li>
          <li>
            <Link
              href="/hygiene/registre"
              className={`${uiCard} block font-medium text-indigo-700 transition hover:border-indigo-200 hover:shadow-md`}
            >
              Registre nettoyage
            </Link>
          </li>
          <li>
            <Link
              href="/hygiene/haccp"
              className={`${uiCard} block font-medium text-indigo-700 transition hover:border-indigo-200 hover:shadow-md`}
            >
              Températures HACCP
            </Link>
          </li>
          <li>
            <Link
              href="/hygiene/temperatures-ouverture"
              className={`${uiCard} block font-medium text-indigo-700 transition hover:border-indigo-200 hover:shadow-md`}
            >
              Froid : ouverture / fermeture
            </Link>
          </li>
          <li>
            <Link
              href="/hygiene/registre-temperatures"
              className={`${uiCard} block font-medium text-indigo-700 transition hover:border-indigo-200 hover:shadow-md`}
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
                <span className="font-medium text-slate-900">{t.element_name}</span>
                <span className="ml-2 text-xs text-slate-500">
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
    </div>
  );
}
