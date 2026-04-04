import Link from "next/link";
import { notFound } from "next/navigation";
import { getServiceTheoreticalState } from "@/lib/serviceStock";
type Props = { params: Promise<{ id: string }> };

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

function formatServiceType(type: string) {
  return type === "lunch" ? "Déjeuner" : "Dîner";
}

export default async function ServiceStockPage({ params }: Props) {
  const { id } = await params;
  const result = await getServiceTheoreticalState(id);

  if (result.error || !result.data) {
    notFound();
  }

  const { service, sales, consumptionResult, soldDishes } = result.data;
  const { consumption, warnings } = consumptionResult;

  const dishIdToDish = new Map(soldDishes.map((d) => [d.id, d]));
  const alerts: { type: string; message: string }[] = [];

  for (const w of warnings) {
    if (w.type === "missing_recipe") {
      const dish = w.dish_id ? dishIdToDish.get(w.dish_id) : null;
      alerts.push({
        type: "Plat sans recette",
        message: dish ? `« ${dish.name} » n'a pas de recette. Aucune consommation calculée.` : w.message,
      });
    } else if (w.type === "draft_recipe") {
      const dish = w.dish_id ? dishIdToDish.get(w.dish_id) : null;
      alerts.push({
        type: "Recette en brouillon",
        message: dish ? `« ${dish.name} » : recette en brouillon, non utilisée pour le stock. Validez la recette pour l'inclure.` : w.message,
      });
    } else if (w.type === "prep_without_components") {
      alerts.push({ type: "Préparation incomplète", message: w.message });
    } else if (w.type === "cycle") {
      alerts.push({ type: "Boucle de composition", message: w.message });
    }
  }

  for (const d of soldDishes) {
    if (d.recipe_status === "missing") {
      if (!warnings.some((w) => (w.type === "missing_recipe" || w.type === "draft_recipe") && w.dish_id === d.id)) {
        alerts.push({
          type: "Plat sans recette",
          message: `« ${d.name} » n'a pas de recette.`,
        });
      }
    }
  }

  const isPartialCalculation = alerts.length > 0;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-4xl px-4 py-6">
        <div className="mb-6">
          <Link
            href={`/service/${id}`}
            className="text-slate-600 underline decoration-slate-400 underline-offset-2"
          >
            ← Retour au service
          </Link>
        </div>

        <h1 className="mb-6 text-xl font-semibold text-slate-900">
          État théorique après service
        </h1>

        {isPartialCalculation && (
          <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <strong>Calcul partiel.</strong> Certaines recettes manquent ou sont en brouillon. La consommation affichée est théorique ; voir les alertes ci-dessous.
          </div>
        )}

        {/* 1. Résumé du service */}
        <section className="mb-6 rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-medium text-slate-500">Résumé du service</h2>
          <p className="text-slate-900">
            <span className="font-medium">Date :</span> {formatDate(service.service_date)}
          </p>
          <p className="mt-1 text-slate-900">
            <span className="font-medium">Type :</span> {formatServiceType(service.service_type)}
          </p>
        </section>

        {/* 2. Ventes validées */}
        <section className="mb-6 rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-medium text-slate-500">Ventes validées</h2>
          {sales.length === 0 ? (
            <p className="text-sm text-slate-500">Aucune vente enregistrée.</p>
          ) : (
            <ul className="space-y-1 text-sm text-slate-700">
              {sales.map((s) => (
                <li key={s.id}>
                  <strong>{(s.dishes as { name: string } | null)?.name ?? s.dish_id}</strong> : {s.qty} vendu{s.qty > 1 ? "s" : ""}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* 3. Consommation théorique */}
        <section className="mb-6 rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-medium text-slate-500">Consommation théorique</h2>
          <p className="mb-3 text-xs text-slate-500">
            Quantités théoriquement consommées (ingrédients, préparations, reventes) à partir des recettes. Ce n&apos;est pas le stock restant.
          </p>
          {consumption.length === 0 ? (
            <p className="text-sm text-slate-500">
              Aucune consommation calculée (ventes vides ou plats sans recette).
            </p>
          ) : (
            <ul className="space-y-1 text-sm text-slate-700">
              {consumption.map((c) => (
                <li key={c.inventory_item_id}>
                  <strong>{c.name}</strong> : {c.qty} {c.unit}
                  <span className="ml-1 text-xs text-slate-500">({c.item_type})</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* 4. Alertes */}
        <section className="mb-6 rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-medium text-slate-500">Alertes</h2>
          {alerts.length === 0 ? (
            <p className="text-sm text-slate-500">Aucune alerte.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {alerts.map((a, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 rounded border border-amber-200 bg-amber-50/50 py-2 px-3 text-amber-800"
                >
                  <span className="shrink-0 font-medium">{a.type}</span>
                  <span>{a.message}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="mt-8">
          <Link
            href="/"
            className="text-slate-600 underline decoration-slate-400 underline-offset-2"
          >
            Retour à l&apos;accueil
          </Link>
        </div>
      </div>
    </div>
  );
}
