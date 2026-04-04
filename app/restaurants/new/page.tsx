import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser, getCurrentRestaurant } from "@/lib/auth";
import { getRestaurantTemplates } from "@/lib/templates/restaurantTemplates";
import { CreateRestaurantForm } from "./CreateRestaurantForm";

export default async function NewRestaurantPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const current = await getCurrentRestaurant();
  if (!current) redirect("/onboarding");

  const templates = getRestaurantTemplates();

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="mb-6">
          <Link
            href="/dashboard"
            className="text-sm text-slate-600 underline decoration-slate-400 underline-offset-2"
          >
            ← Tableau de bord
          </Link>
        </div>
        <h1 className="mb-2 text-xl font-semibold text-slate-900">
          Créer un restaurant
        </h1>
        <p className="mb-6 text-sm text-slate-500">
          Ajoutez un autre restaurant à votre compte.
        </p>
        <CreateRestaurantForm templates={templates} />
      </div>
    </div>
  );
}
