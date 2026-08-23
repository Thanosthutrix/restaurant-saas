"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { savePlatformCompanyAction } from "@/app/admin/company/actions";
import type { PlatformCompany } from "@/lib/platform/companyDb";

type Props = {
  company: PlatformCompany | null;
};

export function CompanyProfileForm({ company }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    const fd = new FormData(e.currentTarget);
    const result = await savePlatformCompanyAction({
      legalName: String(fd.get("legalName") ?? ""),
      legalForm: String(fd.get("legalForm") ?? "") || null,
      siren: String(fd.get("siren") ?? "") || null,
      siret: String(fd.get("siret") ?? "") || null,
      rcsVille: String(fd.get("rcsVille") ?? "") || null,
      capital: String(fd.get("capital") ?? "") || null,
      address: String(fd.get("address") ?? "") || null,
      representativeName: String(fd.get("representativeName") ?? "") || null,
      representativeRole: String(fd.get("representativeRole") ?? "") || null,
      contactEmail: String(fd.get("contactEmail") ?? "") || null,
      apeCode: String(fd.get("apeCode") ?? "") || null,
      vatNumber: String(fd.get("vatNumber") ?? "") || null,
    });

    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSuccess(true);
    router.refresh();
  }

  const inputCls =
    "mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {!company ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Commencez par renseigner les informations légales de votre société Ubion. Ces données
          alimentent les mentions légales et la gestion de vos factures.
        </div>
      ) : null}

      <section className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-gray-900">Identité juridique</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="text-xs font-medium text-gray-500">Raison sociale *</span>
            <input
              name="legalName"
              required
              defaultValue={company?.legal_name ?? "Ubion"}
              className={inputCls}
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-gray-500">Forme juridique</span>
            <input
              name="legalForm"
              placeholder="SASU, SAS, EURL…"
              defaultValue={company?.legal_form ?? ""}
              className={inputCls}
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-gray-500">Capital social</span>
            <input name="capital" placeholder="1 000 €" defaultValue={company?.capital ?? ""} className={inputCls} />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-gray-500">SIREN</span>
            <input name="siren" defaultValue={company?.siren ?? ""} className={inputCls} />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-gray-500">SIRET</span>
            <input name="siret" defaultValue={company?.siret ?? ""} className={inputCls} />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-gray-500">Ville RCS</span>
            <input name="rcsVille" defaultValue={company?.rcs_ville ?? ""} className={inputCls} />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-gray-500">Code APE</span>
            <input name="apeCode" defaultValue={company?.ape_code ?? ""} className={inputCls} />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-xs font-medium text-gray-500">Siège social</span>
            <textarea
              name="address"
              rows={2}
              defaultValue={company?.address ?? ""}
              className={inputCls}
            />
          </label>
        </div>
      </section>

      <section className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-gray-900">Représentant & contact</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-medium text-gray-500">Représentant légal</span>
            <input
              name="representativeName"
              defaultValue={company?.representative_name ?? ""}
              className={inputCls}
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-gray-500">Qualité</span>
            <input
              name="representativeRole"
              placeholder="Président"
              defaultValue={company?.representative_role ?? ""}
              className={inputCls}
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-gray-500">Email contact</span>
            <input
              name="contactEmail"
              type="email"
              defaultValue={company?.contact_email ?? "contact@ubion.fr"}
              className={inputCls}
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-gray-500">N° TVA intracommunautaire</span>
            <input name="vatNumber" defaultValue={company?.vat_number ?? ""} className={inputCls} />
          </label>
        </div>
      </section>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {success ? <p className="text-sm text-emerald-700">Profil enregistré.</p> : null}

      <button
        type="submit"
        disabled={loading}
        className="rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:opacity-60"
      >
        {loading ? "Enregistrement…" : company ? "Mettre à jour" : "Créer ma société"}
      </button>
    </form>
  );
}
