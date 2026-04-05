"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { DELIVERY_NOTES_BUCKET } from "@/lib/constants";
import type { Supplier } from "@/lib/db";
import { createReceptionFromBlPhotoAction } from "./actions";
import { uiBtnPrimary, uiLabel, uiLead, uiSelect } from "@/components/ui/premium";

type Props = {
  restaurantId: string;
  suppliers: Supplier[];
};

export function LivraisonBlForm({ restaurantId, suppliers }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supplierId) {
      setError("Choisissez un fournisseur.");
      return;
    }
    if (!file) {
      setError("Choisissez une photo ou un fichier du bon de livraison.");
      return;
    }
    setError(null);
    setLoading(true);
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${restaurantId}/${supplierId}/${crypto.randomUUID()}.${ext}`;
    const { error: uploadErr } = await supabase.storage.from(DELIVERY_NOTES_BUCKET).upload(path, file, {
      cacheControl: "3600",
      upsert: false,
    });
    if (uploadErr) {
      setError("Échec de l’envoi du fichier : " + uploadErr.message);
      setLoading(false);
      return;
    }

    const result = await createReceptionFromBlPhotoAction({
      restaurantId,
      supplierId,
      filePath: path,
      fileName: file.name,
    });
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setFile(null);
    if (inputRef.current) inputRef.current.value = "";
    const q = result.analysisError
      ? `?analysisError=${encodeURIComponent(result.analysisError)}`
      : "";
    router.push(`/receiving/${result.deliveryNoteId}${q}`);
    router.refresh();
  }

  if (suppliers.length === 0) {
    return (
      <p className={`rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 ${uiLead}`}>
        Ajoutez d’abord un fournisseur dans l’onglet Fournisseurs pour enregistrer un BL.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className={uiLabel}>Fournisseur</label>
        <select
          className={`mt-1 w-full ${uiSelect}`}
          value={supplierId}
          onChange={(e) => setSupplierId(e.target.value)}
          disabled={loading}
        >
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <p className={`mt-1 text-xs ${uiLead}`}>
          Le BL peut venir d’une commande passée hors appli : on rattache quand même les quantités au stock après
          validation.
        </p>
      </div>
      <div>
        <label className={uiLabel}>Photo ou image du BL</label>
        <input
          ref={inputRef}
          type="file"
          accept="image/*,.pdf"
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setError(null);
          }}
          disabled={loading}
          className="mt-1 block w-full text-sm text-slate-600 file:mr-2 file:rounded file:border-0 file:bg-slate-200 file:px-3 file:py-1 file:text-sm"
        />
        <p className={`mt-1 text-xs ${uiLead}`}>
          L’analyse automatique des lignes fonctionne surtout avec une <strong className="font-medium">photo</strong>{" "}
          nette (JPG, PNG). Les PDF s’enregistrent mais ne sont pas encore analysés automatiquement.
        </p>
      </div>
      {error ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800" role="alert">
          {error}
        </p>
      ) : null}
      <button type="submit" disabled={loading || !file} className={uiBtnPrimary}>
        {loading ? "Traitement…" : "Créer la réception et analyser le BL"}
      </button>
    </form>
  );
}
