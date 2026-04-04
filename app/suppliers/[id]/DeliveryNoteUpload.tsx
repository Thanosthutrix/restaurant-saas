"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { DELIVERY_NOTES_BUCKET } from "@/lib/constants";
import { createDeliveryNoteAction } from "../actions";

type PurchaseOrderOption = { id: string; createdAt: string; label: string };

type Props = {
  restaurantId: string;
  supplierId: string;
  purchaseOrders: PurchaseOrderOption[];
};

type UploadState = "aucun_fichier" | "pret" | "upload_en_cours" | "succes" | "erreur";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

export function DeliveryNoteUpload({ restaurantId, supplierId, purchaseOrders }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [purchaseOrderId, setPurchaseOrderId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ deliveryNoteId: string } | null>(null);

  const uploadState: UploadState = loading
    ? "upload_en_cours"
    : error
      ? "erreur"
      : success
        ? "succes"
        : file
          ? "pret"
          : "aucun_fichier";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setError("Choisissez un fichier.");
      return;
    }
    setError(null);
    setSuccess(null);
    setLoading(true);
    const ext = file.name.split(".").pop() || "pdf";
    const path = `${restaurantId}/${supplierId}/${crypto.randomUUID()}.${ext}`;
    const { error: uploadErr } = await supabase.storage.from(DELIVERY_NOTES_BUCKET).upload(path, file, {
      cacheControl: "3600",
      upsert: false,
    });
    if (uploadErr) {
      setError("Échec de l'upload : " + uploadErr.message);
      setLoading(false);
      return;
    }
    const result = await createDeliveryNoteAction({
      restaurantId,
      supplierId,
      purchaseOrderId: purchaseOrderId || null,
      filePath: path,
      fileName: file.name,
    });
    setLoading(false);
    if (result.ok) {
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      setSuccess({ deliveryNoteId: result.deliveryNoteId });
      router.refresh();
    } else {
      setError(result.error ?? "Erreur à l'enregistrement du BL.");
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const chosen = e.target.files?.[0] ?? null;
    setFile(chosen);
    setError(null);
    setSuccess(null);
  }

  const stateLabels: Record<UploadState, string> = {
    aucun_fichier: "Aucun fichier choisi",
    pret: "Prêt à envoyer",
    upload_en_cours: "Upload en cours…",
    succes: "Succès",
    erreur: "Erreur",
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">
          Fichier du bon de livraison
        </label>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,image/*"
          onChange={handleFileChange}
          disabled={loading}
          className="block w-full text-sm text-slate-600 file:mr-2 file:rounded file:border-0 file:bg-slate-200 file:px-3 file:py-1 file:text-sm file:font-medium file:text-slate-800"
        />
        {/* Affichage du fichier sélectionné et état (debug visible) */}
        <div className="mt-2 rounded border border-slate-200 bg-slate-50/80 px-3 py-2 text-xs">
          <p className="font-medium text-slate-700">
            Fichier : {file ? file.name : "—"}
          </p>
          {file && (
            <p className="mt-0.5 text-slate-600">
              Taille : {formatFileSize(file.size)}
            </p>
          )}
          <p className="mt-1 font-medium">
            État : {stateLabels[uploadState]}
          </p>
        </div>
      </div>
      {purchaseOrders.length > 0 && (
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">
            Associer à une commande (optionnel)
          </label>
          <select
            value={purchaseOrderId}
            onChange={(e) => setPurchaseOrderId(e.target.value)}
            disabled={loading}
            className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
          >
            <option value="">— Aucune —</option>
            {purchaseOrders.map((po) => (
              <option key={po.id} value={po.id}>
                {po.label}
              </option>
            ))}
          </select>
        </div>
      )}
      {error && (
        <p
          className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          role="alert"
        >
          {error}
        </p>
      )}
      {success && (
        <div className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          <p className="font-medium">BL enregistré.</p>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
            <Link
              href={`/receiving/${success.deliveryNoteId}`}
              className="underline underline-offset-2"
            >
              Ouvrir la réception
            </Link>
            <span className="text-emerald-700">·</span>
            <Link
              href={`/receiving/${success.deliveryNoteId}`}
              className="underline underline-offset-2"
            >
              Voir le fichier BL (dans la réception)
            </Link>
          </p>
        </div>
      )}
      <button
        type="submit"
        disabled={loading || !file}
        className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? "Upload en cours…" : "Enregistrer le BL"}
      </button>
    </form>
  );
}
