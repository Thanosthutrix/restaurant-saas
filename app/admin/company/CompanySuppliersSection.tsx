"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createPlatformSupplierAction } from "@/app/admin/company/actions";
import type { PlatformSupplier } from "@/lib/platform/companyDb";

type Props = {
  suppliers: PlatformSupplier[];
};

export function CompanySuppliersSection({ suppliers }: Props) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const result = await createPlatformSupplierAction({ name, email: email || null });
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setName("");
    setEmail("");
    router.refresh();
  }

  return (
    <section className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
      <h2 className="mb-1 text-sm font-semibold text-gray-900">Fournisseurs</h2>
      <p className="mb-4 text-xs text-gray-500">
        Vos prestataires (hébergeur, comptable, outils SaaS…) pour classer les factures.
      </p>

      {suppliers.length > 0 ? (
        <ul className="mb-4 divide-y divide-gray-50 rounded-lg border border-gray-100">
          {suppliers.map((s) => (
            <li key={s.id} className="flex items-center justify-between px-3 py-2.5 text-sm">
              <span className="font-medium text-gray-900">{s.name}</span>
              {s.email ? <span className="text-xs text-gray-400">{s.email}</span> : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-4 text-sm italic text-gray-400">Aucun fournisseur — ajoutez-en un ci-dessous.</p>
      )}

      <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-3">
        <label className="min-w-[10rem] flex-1">
          <span className="text-xs font-medium text-gray-500">Nom</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            placeholder="Vercel, Expert-comptable…"
          />
        </label>
        <label className="min-w-[10rem] flex-1">
          <span className="text-xs font-medium text-gray-500">Email (optionnel)</span>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
          />
        </label>
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-60"
        >
          Ajouter
        </button>
      </form>
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
    </section>
  );
}
