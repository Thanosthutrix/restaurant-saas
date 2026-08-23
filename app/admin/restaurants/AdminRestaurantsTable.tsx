"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowUpRight, Clock, Search } from "lucide-react";
import {
  getAdminClientStatus,
  getAdminClientStatusLabel,
  type AdminClientStatus,
  type AdminRestaurant,
} from "@/lib/admin/types";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

type FilterStatus = "all" | AdminClientStatus;

type Props = {
  restaurants: AdminRestaurant[];
};

export function AdminRestaurantsTable({ restaurants }: Props) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return restaurants.filter((r) => {
      const status = getAdminClientStatus(r);
      if (statusFilter !== "all" && status !== statusFilter) return false;
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q) ||
        (r.owner_email?.toLowerCase().includes(q) ?? false) ||
        (r.owner_name?.toLowerCase().includes(q) ?? false) ||
        (r.activity_type?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [restaurants, query, statusFilter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher par restaurant, email, nom…"
            className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 [color-scheme:light] focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/25"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as FilterStatus)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 [color-scheme:light] focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/25"
        >
          <option value="all">Tous les statuts</option>
          <option value="active">Actifs</option>
          <option value="trial">En essai</option>
          <option value="trial_expired">Essai expiré</option>
          <option value="suspended">Suspendus</option>
          <option value="inactive">Inactifs 7j+</option>
        </select>
      </div>

      <p className="text-xs text-gray-500">
        {filtered.length} résultat{filtered.length > 1 ? "s" : ""}
        {query || statusFilter !== "all" ? ` sur ${restaurants.length}` : ""}
      </p>

      <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Restaurant
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Propriétaire
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Dernière connexion
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Inscrit le
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Statut
                </th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-gray-400">
                    Aucun client ne correspond à votre recherche.
                  </td>
                </tr>
              )}
              {filtered.map((r) => {
                const status = getAdminClientStatusLabel(getAdminClientStatus(r));
                return (
                  <tr key={r.id} className="group transition-colors hover:bg-gray-50">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-50">
                          <span className="text-xs font-bold text-amber-700">
                            {r.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <span className="font-medium text-gray-900">{r.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-gray-500">
                      {r.owner_email ?? <span className="italic text-gray-300">—</span>}
                    </td>
                    <td className="px-5 py-3.5 text-gray-500">
                      {r.owner_last_sign_in ? formatDate(r.owner_last_sign_in) : (
                        <span className="text-orange-600">Jamais</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-gray-500">
                      <div className="flex items-center gap-1.5">
                        <Clock size={12} className="text-gray-300" />
                        {formatDate(r.created_at)}
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${status.color}`}
                      >
                        {status.label}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <Link
                        href={`/admin/restaurants/${r.id}`}
                        className="inline-flex items-center gap-1 text-xs font-medium text-gray-400 transition-colors group-hover:text-amber-600"
                      >
                        Voir <ArrowUpRight size={13} />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
