import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentRestaurant } from "@/lib/auth";
import { getSuppliers } from "@/lib/db";
import { CreateSupplierForm } from "./CreateSupplierForm";

const ORDER_METHOD_LABELS: Record<string, string> = {
  EMAIL: "Email",
  WHATSAPP: "WhatsApp",
  PHONE: "Téléphone",
  PORTAL: "Portail",
};

export default async function SuppliersPage() {
  const restaurant = await getCurrentRestaurant();
  if (!restaurant) redirect("/onboarding");

  const { data: suppliers, error } = await getSuppliers(restaurant.id);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-2xl px-4 py-6">
        <div className="mb-6">
          <Link
            href="/dashboard"
            className="text-slate-600 underline decoration-slate-400 underline-offset-2"
          >
            ← Tableau de bord
          </Link>
        </div>

        <h1 className="mb-2 text-xl font-semibold text-slate-900">
          Fournisseurs
        </h1>
        <p className="mb-6 text-sm text-slate-500">
          Coordonnées, jours de commande et canal préféré pour chaque fournisseur.
        </p>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">
            {error.message}
          </div>
        )}

        <CreateSupplierForm restaurantId={restaurant.id} />

        <div className="mt-8">
          <h2 className="mb-3 text-lg font-medium text-slate-800">
            Liste des fournisseurs
          </h2>
          {!suppliers?.length ? (
            <p className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-500">
              Aucun fournisseur. Créez-en un ci-dessus.
            </p>
          ) : (
            <ul className="space-y-2">
              {suppliers.map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/suppliers/${s.id}`}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white p-3 transition hover:bg-slate-50"
                  >
                    <span className="font-medium text-slate-900">{s.name}</span>
                    <span className="text-sm text-slate-500">
                      {ORDER_METHOD_LABELS[s.preferred_order_method] ?? s.preferred_order_method}
                      {(s.order_days?.length ?? 0) > 0 && ` · ${(s.order_days ?? []).join(", ")}`}
                      {!s.is_active && " · Inactif"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <p className="mt-6">
          <Link
            href="/orders/suggestions"
            className="text-sm text-slate-600 underline"
          >
            Voir les commandes suggérées
          </Link>
        </p>
      </div>
    </div>
  );
}
