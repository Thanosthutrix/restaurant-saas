"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateSupplierAction } from "../actions";
import type { Supplier } from "@/lib/db";

const ORDER_METHODS = [
  { value: "EMAIL", label: "Email" },
  { value: "WHATSAPP", label: "WhatsApp" },
  { value: "PHONE", label: "Téléphone" },
  { value: "PORTAL", label: "Portail" },
] as const;

const WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;
const WEEKDAY_LABELS: Record<string, string> = {
  monday: "Lundi",
  tuesday: "Mardi",
  wednesday: "Mercredi",
  thursday: "Jeudi",
  friday: "Vendredi",
  saturday: "Samedi",
};

export function EditSupplierForm({ supplier }: { supplier: Supplier }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orderDays, setOrderDays] = useState<string[]>(supplier.order_days ?? []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const form = e.currentTarget;
    const formData = new FormData(form);
    formData.set("orderDays", orderDays.join(","));
    const result = await updateSupplierAction(supplier.id, formData);
    setLoading(false);
    if (result.ok) router.refresh();
    else setError(result.error);
  }

  function toggleDay(day: string) {
    setOrderDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border border-slate-200 bg-white p-4"
    >
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
      <div className="space-y-3">
        <label className="block">
          <span className="text-xs text-slate-500">Nom *</span>
          <input
            type="text"
            name="name"
            defaultValue={supplier.name}
            required
            className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
          />
        </label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs text-slate-500">Email</span>
            <input type="email" name="email" defaultValue={supplier.email ?? ""} className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1.5 text-sm" />
          </label>
          <label className="block">
            <span className="text-xs text-slate-500">Téléphone</span>
            <input type="text" name="phone" defaultValue={supplier.phone ?? ""} className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1.5 text-sm" />
          </label>
        </div>
        <label className="block">
          <span className="text-xs text-slate-500">WhatsApp</span>
          <input type="text" name="whatsapp_phone" defaultValue={supplier.whatsapp_phone ?? ""} className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1.5 text-sm" />
        </label>
        <label className="block">
          <span className="text-xs text-slate-500">Adresse</span>
          <textarea name="address" rows={2} defaultValue={supplier.address ?? ""} className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1.5 text-sm" />
        </label>
        <label className="block">
          <span className="text-xs text-slate-500">Méthode de commande préférée</span>
          <select
            name="preferred_order_method"
            defaultValue={supplier.preferred_order_method}
            className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
          >
            {ORDER_METHODS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <div>
          <span className="text-xs text-slate-500">Jours de commande</span>
          <div className="mt-1 flex flex-wrap gap-2">
            {WEEKDAYS.map((d) => (
              <label key={d} className="flex items-center gap-1 text-sm">
                <input
                  type="checkbox"
                  checked={orderDays.includes(d)}
                  onChange={() => toggleDay(d)}
                />
                {WEEKDAY_LABELS[d]}
              </label>
            ))}
          </div>
        </div>
        <label className="block">
          <span className="text-xs text-slate-500">Heure limite (optionnel)</span>
          <input type="time" name="cut_off_time" defaultValue={supplier.cut_off_time ?? ""} className="mt-0.5 rounded border border-slate-300 px-2 py-1.5 text-sm" />
        </label>
        <label className="block">
          <span className="text-xs text-slate-500">Délai livraison (jours)</span>
          <input type="number" name="lead_time_days" min={0} defaultValue={supplier.lead_time_days ?? ""} className="mt-0.5 w-24 rounded border border-slate-300 px-2 py-1.5 text-sm" />
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="is_active" value="true" defaultChecked={supplier.is_active} />
          <span className="text-sm">Fournisseur actif</span>
        </label>
        <label className="block">
          <span className="text-xs text-slate-500">Notes</span>
          <textarea name="notes" rows={2} defaultValue={supplier.notes ?? ""} className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1.5 text-sm" />
        </label>
      </div>
      <div className="mt-3">
        <button
          type="submit"
          disabled={loading}
          className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {loading ? "Enregistrement…" : "Enregistrer"}
        </button>
      </div>
    </form>
  );
}
