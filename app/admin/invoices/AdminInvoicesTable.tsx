"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, FileText, Search } from "lucide-react";
import {
  getAdminInvoiceStatusLabel,
  type AdminInvoiceListRow,
} from "@/lib/admin/invoiceTypes";

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatEur(n: number | null) {
  if (n == null) return "—";
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);
}

type FilterStatus = "all" | "draft" | "linked" | "reviewed" | "needs_review";

type Props = {
  invoices: AdminInvoiceListRow[];
};

export function AdminInvoicesTable({ invoices }: Props) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return invoices.filter((inv) => {
      if (statusFilter === "needs_review") {
        if (inv.status !== "linked" && inv.status !== "draft") return false;
      } else if (statusFilter !== "all" && inv.status !== statusFilter) {
        return false;
      }
      if (!q) return true;
      return (
        inv.restaurant_name.toLowerCase().includes(q) ||
        inv.supplier_name.toLowerCase().includes(q) ||
        (inv.invoice_number?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [invoices, query, statusFilter]);

  const inputClass =
    "w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 [color-scheme:light] focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/25";

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Restaurant, fournisseur, n° facture…"
            className={inputClass}
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as FilterStatus)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 [color-scheme:light] focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/25"
        >
          <option value="all">Tous les statuts</option>
          <option value="needs_review">À traiter / contrôler</option>
          <option value="draft">À traiter</option>
          <option value="linked">À contrôler</option>
          <option value="reviewed">Prêtes comptable</option>
        </select>
      </div>

      <p className="text-xs text-gray-500">
        {filtered.length} facture{filtered.length > 1 ? "s" : ""}
        {query || statusFilter !== "all" ? ` sur ${invoices.length}` : ""}
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
                  Fournisseur
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Facture
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Montant TTC
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
                    Aucune facture ne correspond.
                  </td>
                </tr>
              )}
              {filtered.map((inv) => (
                <tr key={inv.id} className="group transition-colors hover:bg-gray-50">
                  <td className="px-5 py-3.5 font-medium text-gray-900">{inv.restaurant_name}</td>
                  <td className="px-5 py-3.5 text-gray-500">{inv.supplier_name}</td>
                  <td className="px-5 py-3.5 text-gray-500">
                    <div>{inv.invoice_number ?? "—"}</div>
                    <div className="text-xs text-gray-400">{formatDate(inv.invoice_date)}</div>
                  </td>
                  <td className="px-5 py-3.5 text-gray-700">{formatEur(inv.amount_ttc)}</td>
                  <td className="px-5 py-3.5">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        inv.status === "reviewed"
                          ? "bg-green-50 text-green-700"
                          : inv.status === "linked"
                            ? "bg-amber-50 text-amber-700"
                            : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {getAdminInvoiceStatusLabel(inv.status)}
                    </span>
                    {inv.delivery_notes_count > 0 && (
                      <span className="ml-1 text-xs text-gray-400">
                        · {inv.delivery_notes_count} BL
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <Link
                      href={`/admin/invoices/${inv.id}`}
                      className="inline-flex items-center gap-1 text-xs font-medium text-gray-400 transition-colors group-hover:text-amber-600"
                    >
                      Voir <ArrowUpRight size={13} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function AdminInvoicesEmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-gray-200 bg-white px-6 py-16 text-center">
      <FileText className="mx-auto mb-3 text-gray-300" size={32} />
      <p className="text-sm text-gray-500">Aucune facture fournisseur enregistrée.</p>
    </div>
  );
}
