/**
 * Liste de tous les clients — espace admin.
 */

import Link from "next/link";
import { FlaskConical, Download } from "lucide-react";
import { getAllRestaurantsWithOwners, getAdminClientStatus } from "@/lib/admin";
import { AdminRestaurantsTable } from "./AdminRestaurantsTable";

export default async function AdminRestaurantsPage() {
  const restaurants = await getAllRestaurantsWithOwners();

  const total = restaurants.length;
  const suspended = restaurants.filter((r) => getAdminClientStatus(r) === "suspended").length;
  const trials = restaurants.filter((r) => getAdminClientStatus(r) === "trial").length;
  const inactive = restaurants.filter((r) => getAdminClientStatus(r) === "inactive").length;
  const actifs = restaurants.filter((r) => getAdminClientStatus(r) === "active").length;

  return (
    <div className="mx-auto max-w-6xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
          <p className="mt-1 text-sm text-gray-500">
            {total} restaurant{total > 1 ? "s" : ""} —{" "}
            <span className="text-green-600">
              {actifs} actif{actifs > 1 ? "s" : ""}
            </span>
            {trials > 0 && (
              <>
                , <span className="text-amber-600">{trials} en essai</span>
              </>
            )}
            {inactive > 0 && (
              <>
                , <span className="text-orange-600">{inactive} inactif{inactive > 1 ? "s" : ""}</span>
              </>
            )}
            {suspended > 0 && (
              <>
                , <span className="text-red-500">{suspended} suspendu{suspended > 1 ? "s" : ""}</span>
              </>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <a
            href="/api/admin/export-csv"
            className="flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
          >
            <Download size={15} />
            Export CSV
          </a>
          <Link
            href="/admin/trials/new"
            className="flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-600"
          >
            <FlaskConical size={15} />
            Créer un essai
          </Link>
        </div>
      </div>

      <AdminRestaurantsTable restaurants={restaurants} />
    </div>
  );
}
