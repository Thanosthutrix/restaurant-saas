"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { CustomerSource } from "@/lib/customers/types";
import { createCustomerAction, findDuplicateCustomersAction } from "../actions";
import { uiBtnPrimarySm, uiCard, uiInput, uiLabel } from "@/components/ui/premium";

const SOURCES: { value: CustomerSource; label: string }[] = [
  { value: "walk_in", label: "Passage" },
  { value: "phone", label: "Téléphone" },
  { value: "website", label: "Site / web" },
  { value: "referral", label: "Recommandation" },
  { value: "social", label: "Réseaux sociaux" },
  { value: "event", label: "Événement" },
  { value: "import", label: "Import" },
  { value: "other", label: "Autre" },
];

export function CustomerNewClient({ restaurantId }: { restaurantId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [dupHint, setDupHint] = useState<string | null>(null);

  async function checkDup(email: string, phone: string) {
    setDupHint(null);
    if (!email.trim() && !phone.trim()) return;
    const r = await findDuplicateCustomersAction(restaurantId, email || null, phone || null);
    if (!r.ok || r.matches.length === 0) return;
    const names = r.matches.map((m) => m.display_name).join(", ");
    setDupHint(`Fiche(s) existante(s) avec le même email ou téléphone : ${names}. Vérifiez avant de créer un doublon.`);
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const display_name = String(fd.get("display_name") ?? "").trim();
    if (!display_name) {
      setError("Le nom affiché est obligatoire.");
      return;
    }
    start(async () => {
      const r = await createCustomerAction(restaurantId, {
        display_name,
        first_name: String(fd.get("first_name") ?? "").trim() || null,
        last_name: String(fd.get("last_name") ?? "").trim() || null,
        email: String(fd.get("email") ?? "").trim() || null,
        phone: String(fd.get("phone") ?? "").trim() || null,
        preferred_locale: String(fd.get("preferred_locale") ?? "fr") || "fr",
        birth_date: String(fd.get("birth_date") ?? "").trim() || null,
        company_name: String(fd.get("company_name") ?? "").trim() || null,
        address_line1: String(fd.get("address_line1") ?? "").trim() || null,
        address_line2: String(fd.get("address_line2") ?? "").trim() || null,
        postal_code: String(fd.get("postal_code") ?? "").trim() || null,
        city: String(fd.get("city") ?? "").trim() || null,
        country: String(fd.get("country") ?? "FR").trim() || "FR",
        internal_notes: String(fd.get("internal_notes") ?? "").trim() || null,
        allergens_note: String(fd.get("allergens_note") ?? "").trim() || null,
        source: (String(fd.get("source") ?? "other") || "other") as CustomerSource,
        marketing_opt_in: fd.get("marketing_opt_in") === "on",
        service_messages_opt_in: fd.get("service_messages_opt_in") === "on",
        analytics_opt_in: fd.get("analytics_opt_in") === "on",
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      router.push(`/clients/${r.id}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className={`${uiCard} space-y-6`}>
      {error ? <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p> : null}
      {dupHint ? <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{dupHint}</p> : null}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">Identité</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={uiLabel}>
            Nom affiché *
            <input name="display_name" required className={uiInput} placeholder="ex. Marie Dupont" />
          </label>
          <label className={uiLabel}>
            Entreprise
            <input name="company_name" className={uiInput} />
          </label>
          <label className={uiLabel}>
            Prénom
            <input name="first_name" className={uiInput} />
          </label>
          <label className={uiLabel}>
            Nom
            <input name="last_name" className={uiInput} />
          </label>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">Contact</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={uiLabel}>
            Email
            <input
              name="email"
              type="email"
              className={uiInput}
              onBlur={(e) => void checkDup(e.target.value, (document.querySelector('[name="phone"]') as HTMLInputElement)?.value ?? "")}
            />
          </label>
          <label className={uiLabel}>
            Téléphone
            <input
              name="phone"
              type="tel"
              className={uiInput}
              onBlur={(e) =>
                void checkDup(
                  (document.querySelector('[name="email"]') as HTMLInputElement)?.value ?? "",
                  e.target.value
                )
              }
            />
          </label>
          <label className={uiLabel}>
            Langue préférée
            <select name="preferred_locale" className={uiInput} defaultValue="fr">
              <option value="fr">Français</option>
              <option value="en">English</option>
            </select>
          </label>
          <label className={uiLabel}>
            Date de naissance
            <input name="birth_date" type="date" className={uiInput} />
          </label>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">Adresse</h2>
        <div className="grid gap-3">
          <label className={uiLabel}>
            Ligne 1
            <input name="address_line1" className={uiInput} />
          </label>
          <label className={uiLabel}>
            Ligne 2
            <input name="address_line2" className={uiInput} />
          </label>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className={uiLabel}>
              Code postal
              <input name="postal_code" className={uiInput} />
            </label>
            <label className={`${uiLabel} sm:col-span-2`}>
              Ville
              <input name="city" className={uiInput} />
            </label>
          </div>
          <label className={uiLabel}>
            Pays
            <input name="country" className={uiInput} defaultValue="FR" />
          </label>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">Service & notes</h2>
        <label className={uiLabel}>
          Origine de la fiche
          <select name="source" className={uiInput} defaultValue="other">
            {SOURCES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className={uiLabel}>
          Notes internes (équipe)
          <textarea name="internal_notes" rows={3} className={uiInput} />
        </label>
        <label className={uiLabel}>
          Allergies / régimes (à confirmer avec le client ; responsabilité du restaurateur)
          <textarea name="allergens_note" rows={2} className={uiInput} />
        </label>
      </section>

      <section className="space-y-3 rounded-xl border border-slate-100 bg-slate-50/80 p-4">
        <h2 className="text-sm font-semibold text-slate-900">Consentements (RGPD)</h2>
        <label className="flex cursor-pointer items-start gap-2 text-sm text-slate-700">
          <input type="checkbox" name="service_messages_opt_in" defaultChecked className="mt-1 h-4 w-4 rounded border-slate-300" />
          <span>
            Messages liés au service (réservations, rappels de créneau) — recommandé pour la bonne exécution du
            contrat.
          </span>
        </label>
        <label className="flex cursor-pointer items-start gap-2 text-sm text-slate-700">
          <input type="checkbox" name="marketing_opt_in" className="mt-1 h-4 w-4 rounded border-slate-300" />
          <span>Communications commerciales (offres, actualités du lieu).</span>
        </label>
        <label className="flex cursor-pointer items-start gap-2 text-sm text-slate-700">
          <input type="checkbox" name="analytics_opt_in" className="mt-1 h-4 w-4 rounded border-slate-300" />
          <span>Enquêtes de satisfaction et statistiques d’usage anonymisées.</span>
        </label>
      </section>

      <button type="submit" disabled={pending} className={uiBtnPrimarySm}>
        {pending ? "Enregistrement…" : "Créer la fiche"}
      </button>
    </form>
  );
}
