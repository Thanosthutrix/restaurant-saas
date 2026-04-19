import Link from "next/link";
import { redirect } from "next/navigation";
import { getRestaurantForPage } from "@/lib/auth";
import { listHygieneElements, listHygieneRecurrencePresets } from "@/lib/hygiene/hygieneDb";
import { uiBackLink, uiLead, uiPageTitle } from "@/components/ui/premium";
import { HygieneElementsClient } from "./HygieneElementsClient";

export default async function HygieneElementsPage() {
  const restaurant = await getRestaurantForPage();
  if (!restaurant) redirect("/onboarding");

  const [elements, presets] = await Promise.all([
    listHygieneElements(restaurant.id),
    listHygieneRecurrencePresets(),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
      <div>
        <Link href="/hygiene" className={uiBackLink}>
          ← Nettoyage
        </Link>
        <h1 className={`mt-4 ${uiPageTitle}`}>Éléments à nettoyer</h1>
        <p className={`mt-2 ${uiLead}`}>
          Référentiel par restaurant. Les fréquences par défaut sont des suggestions (référentiel métier), modifiables
          par ligne. Utilisez <strong className="font-medium text-slate-700">Marquer comme fait</strong> pour enregistrer
          tout de suite une exécution au registre (nom, heure, commentaire et photo optionnelle).
        </p>
      </div>

      <HygieneElementsClient
        restaurantId={restaurant.id}
        elements={elements}
        presets={presets}
      />
    </div>
  );
}
