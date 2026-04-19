import Link from "next/link";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { getTicketImportForControlPage } from "@/lib/sales";
import { getDishes } from "@/lib/db";
import { getRestaurantForPage } from "@/lib/auth";
import { TicketImportLinesBlock } from "./TicketImportLinesBlock";

type Props = { params: Promise<{ id: string }> };

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

function formatServiceType(type: string | null): string {
  if (!type) return "—";
  return type === "lunch" ? "Déjeuner" : type === "dinner" ? "Dîner" : type;
}

function recipeStatusLabel(status: string | null): string {
  if (!status) return "—";
  return status === "validated" ? "Validée" : status === "draft" ? "Brouillon" : status === "missing" ? "Sans recette" : status;
}

export default async function TicketImportControlPage({ params }: Props) {
  const restaurant = await getRestaurantForPage();
  if (!restaurant) redirect("/onboarding");

  const { id } = await params;
  const [controlRes, dishesRes] = await Promise.all([
    getTicketImportForControlPage(id, restaurant.id),
    getDishes(restaurant.id),
  ]);

  if (controlRes.error || !controlRes.data) {
    notFound();
  }

  const { ticketImport, lines, summary, existingSales } = controlRes.data;
  const dishes = dishesRes.data ?? [];
  const dishesWithMissing = [...new Set(lines.filter((l) => l.dish?.recipe_status === "missing").map((l) => l.dish_id!))];
  const dishesWithDraft = [...new Set(lines.filter((l) => l.dish?.recipe_status === "draft").map((l) => l.dish_id!))];

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-4xl px-4 py-6">
        <div className="mb-6">
          <Link
            href="/sales"
            className="text-slate-600 underline decoration-slate-400 underline-offset-2"
          >
            ← Retour
          </Link>
        </div>

        <h1 className="mb-6 text-xl font-semibold text-slate-900">
          Révision du ticket importé
        </h1>

        {/* Résumé */}
        <section className="mb-6 rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-medium text-slate-500">Résumé</h2>
          <ul className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-6">
            <li><span className="text-slate-500">Lignes</span> : {summary.total_lines}</li>
            <li><span className="text-slate-500">Reconnues</span> : {summary.recognized_count}</li>
            <li><span className="text-slate-500">Non reconnues</span> : {summary.unrecognized_count}</li>
            <li><span className="text-slate-500">Ignorées</span> : {summary.ignored_count}</li>
            <li><span className="text-slate-500">Plats sans recette</span> : {summary.dishes_missing_count}</li>
            <li><span className="text-slate-500">Plats en brouillon</span> : {summary.dishes_draft_count}</li>
          </ul>
        </section>

        {/* Infos import */}
        <section className="mb-6 rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-medium text-slate-500">Import</h2>
          <p className="text-sm text-slate-700">
            Date service : {formatDate(ticketImport.service_date ?? null)} · Type : {formatServiceType(ticketImport.service_type)}
            {ticketImport.imported_at && ` · Importé le ${formatDate(ticketImport.imported_at)}`}
          </p>
        </section>

        {/* Image du ticket */}
        {ticketImport.image_url && (
          <section className="mb-6 rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="mb-2 text-sm font-medium text-slate-500">Image du ticket</h2>
            <div className="relative aspect-[3/4] max-w-sm overflow-hidden rounded border border-slate-200">
              <Image
                src={ticketImport.image_url}
                alt="Ticket de caisse"
                fill
                className="object-contain"
                unoptimized
              />
            </div>
          </section>
        )}

        {/* Révision ligne par ligne + prévisualisation + Valider */}
        <TicketImportLinesBlock
          ticketImport={ticketImport}
          lines={lines}
          dishes={dishes}
          existingSalesCount={existingSales.length}
        />

        {/* Problèmes de recette */}
        {(dishesWithMissing.length > 0 || dishesWithDraft.length > 0) && (
          <section className="mb-6 rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="mb-2 text-sm font-medium text-slate-500">Statut des recettes (plats matchés)</h2>
            {dishesWithMissing.length > 0 && (
              <p className="mb-1 text-sm text-amber-700">
                Sans recette : {dishesWithMissing.length} plat(s) — à compléter pour calculer la consommation.
              </p>
            )}
            {dishesWithDraft.length > 0 && (
              <p className="text-sm text-slate-600">
                En brouillon : {dishesWithDraft.length} plat(s) — recette à valider.
              </p>
            )}
            <ul className="mt-2 space-y-1 text-sm text-slate-700">
              {lines
                .filter((l) => l.dish_id && (l.dish?.recipe_status === "missing" || l.dish?.recipe_status === "draft"))
                .reduce((acc, line) => {
                  if (!line.dish_id || !line.dish) return acc;
                  const key = line.dish_id;
                  if (acc.some((x) => x.dish_id === key)) return acc;
                  return [...acc, { dish_id: key, name: line.dish.name, recipe_status: line.dish.recipe_status }];
                }, [] as { dish_id: string; name: string; recipe_status: string | null }[])
                .map((d) => (
                  <li key={d.dish_id}>
                    <strong>{d.name}</strong> : {recipeStatusLabel(d.recipe_status)}
                  </li>
                ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
