"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createPlatformCustomerAction } from "./actions";
import type { PlatformCustomer } from "@/lib/platform/emittedInvoicesDb";

type Props = {
  customers: PlatformCustomer[];
};

export function EmittedCustomersSection({ customers }: Props) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [siret, setSiret] = useState("");
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const result = await createPlatformCustomerAction({
      name,
      email: email || null,
      siret: siret || null,
      address: address || null,
    });
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setName("");
    setEmail("");
    setSiret("");
    setAddress("");
    router.refresh();
  }

  return (
    <section className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
      <h2 className="mb-1 text-sm font-semibold text-gray-900">Clients</h2>
      <p className="mb-4 text-xs text-gray-500">
        Destinataires des factures B2B. Le SIRET est requis pour l&apos;émission PA.
      </p>

      {customers.length > 0 ? (
        <ul className="mb-4 divide-y divide-gray-50 rounded-lg border border-gray-100">
          {customers.map((c) => (
            <li key={c.id} className="px-3 py-2.5 text-sm">
              <p className="font-medium text-gray-900">{c.name}</p>
              <p className="text-xs text-gray-400">
                {[c.siret ? `SIRET ${c.siret}` : null, c.email, c.address].filter(Boolean).join(" · ") ||
                  "Complétez SIRET et adresse avant émission"}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-4 text-sm italic text-gray-400">Aucun client — ajoutez-en un ci-dessous.</p>
      )}

      <form onSubmit={handleAdd} className="space-y-3">
        <div className="flex flex-wrap gap-3">
          <label className="min-w-[10rem] flex-1">
            <span className="text-xs font-medium text-gray-500">Raison sociale</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="min-w-[10rem] flex-1">
            <span className="text-xs font-medium text-gray-500">SIRET</span>
            <input
              value={siret}
              onChange={(e) => setSiret(e.target.value)}
              inputMode="numeric"
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              placeholder="14 chiffres"
            />
          </label>
        </div>
        <div className="flex flex-wrap gap-3">
          <label className="min-w-[10rem] flex-1">
            <span className="text-xs font-medium text-gray-500">Email</span>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="min-w-[10rem] flex-[2]">
            <span className="text-xs font-medium text-gray-500">Adresse</span>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              placeholder="12 rue Example, 75001 Paris"
            />
          </label>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-60"
        >
          Ajouter client
        </button>
        {error ? <p className="text-xs text-red-600">{error}</p> : null}
      </form>
    </section>
  );
}
