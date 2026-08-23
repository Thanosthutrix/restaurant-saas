"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowUpRight, Mail, Search } from "lucide-react";
import {
  getAdminProspectSourceLabel,
  getAdminProspectStatusLabel,
  type AdminProspect,
  type AdminProspectStatus,
} from "@/lib/admin/types";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

type FilterStatus = "all" | AdminProspectStatus | "active";

type Props = {
  prospects: AdminProspect[];
};

export function AdminProspectsTable({ prospects }: Props) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("active");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return prospects.filter((p) => {
      if (statusFilter === "active") {
        if (p.status === "signed_up" || p.status === "lost") return false;
      } else if (statusFilter !== "all" && p.status !== statusFilter) {
        return false;
      }
      if (!q) return true;
      return (
        (p.contact_name?.toLowerCase().includes(q) ?? false) ||
        p.contact_email.toLowerCase().includes(q) ||
        (p.restaurant_name?.toLowerCase().includes(q) ?? false) ||
        (p.phone?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [prospects, query, statusFilter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher par nom, email, restaurant…"
            className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 [color-scheme:light] focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/25"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as FilterStatus)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 [color-scheme:light] focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/25"
        >
          <option value="active">En cours</option>
          <option value="all">Tous</option>
          <option value="new">Nouveaux</option>
          <option value="contacted">Contactés</option>
          <option value="demo_scheduled">Démo planifiée</option>
          <option value="invited">Invités</option>
          <option value="signed_up">Inscrits</option>
          <option value="lost">Perdus</option>
        </select>
      </div>

      <p className="text-xs text-gray-500">
        {filtered.length} résultat{filtered.length > 1 ? "s" : ""}
        {query || statusFilter !== "active" ? ` sur ${prospects.length}` : ""}
      </p>

      <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Contact
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Restaurant prévu
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Source
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Créé le
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
                    Aucun prospect ne correspond à votre recherche.
                  </td>
                </tr>
              )}
              {filtered.map((p) => {
                const status = getAdminProspectStatusLabel(p.status);
                return (
                  <tr key={p.id} className="group transition-colors hover:bg-gray-50">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50">
                          <Mail size={14} className="text-blue-600" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-gray-900">
                            {p.contact_name ?? "—"}
                          </p>
                          <p className="truncate text-xs text-gray-400">{p.contact_email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-gray-500">
                      {p.restaurant_name ?? <span className="italic text-gray-300">—</span>}
                    </td>
                    <td className="px-5 py-3.5 text-gray-500">
                      {getAdminProspectSourceLabel(p.source)}
                    </td>
                    <td className="px-5 py-3.5 text-gray-500">{formatDate(p.created_at)}</td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${status.color}`}
                      >
                        {status.label}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <Link
                        href={`/admin/prospects/${p.id}`}
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
