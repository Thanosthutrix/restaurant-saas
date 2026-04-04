import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUser, getAccessibleRestaurantsForUser } from "@/lib/auth";
import { getRestaurantTemplates } from "@/lib/templates/restaurantTemplates";
import { getTemplateSuggestions } from "../../actions";
import { EditRestaurantForm } from "./EditRestaurantForm";
import { ApplyTemplateBlock } from "./ApplyTemplateBlock";

type Props = { params: Promise<{ id: string }> };

export default async function EditRestaurantPage({ params }: Props) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const list = await getAccessibleRestaurantsForUser(user.id);
  const restaurant = list.find((r) => r.id === id);
  if (!restaurant) notFound();

  const templates = getRestaurantTemplates();
  const { suggestions } = await getTemplateSuggestions(restaurant.id);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-md px-4 py-8">
        <div className="mb-6">
          <Link
            href="/dashboard"
            className="text-sm text-slate-600 underline decoration-slate-400 underline-offset-2"
          >
            ← Tableau de bord
          </Link>
        </div>
        <h1 className="mb-2 text-xl font-semibold text-slate-900">
          Modifier le restaurant
        </h1>
        <p className="mb-6 text-sm text-slate-500">
          {restaurant.name}
        </p>
        <EditRestaurantForm restaurant={restaurant} templates={templates} />
        <div className="mt-6">
          <ApplyTemplateBlock
            restaurantId={restaurant.id}
            templateSlug={restaurant.template_slug}
            suggestions={suggestions}
          />
        </div>
      </div>
    </div>
  );
}
