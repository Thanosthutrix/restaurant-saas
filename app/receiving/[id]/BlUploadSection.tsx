"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { DELIVERY_NOTES_BUCKET } from "@/lib/constants";
import { attachBlToDeliveryNoteAction } from "./actions";

type Props = {
  deliveryNoteId: string;
  restaurantId: string;
  supplierId: string;
  status: string;
  filePath: string | null;
  fileUrl: string | null;
};

export function BlUploadSection({
  deliveryNoteId,
  restaurantId,
  supplierId,
  status,
  filePath,
  fileUrl,
}: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const readOnly = status === "validated";
  const hasFile = !!(filePath || fileUrl);
  const displayUrl = fileUrl ?? null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || readOnly) return;
    setError(null);
    setSuccess(false);
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
    try {
      await attachBlToDeliveryNoteAction(deliveryNoteId, restaurantId, path, file.name);
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      setSuccess(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'attachement du fichier.");
    } finally {
      setLoading(false);
    }
  }

  if (readOnly && hasFile && displayUrl) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-medium text-slate-500">
          Bon de livraison
        </h2>
        <a
          href={displayUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium text-slate-800 underline"
        >
          Voir le fichier BL
        </a>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="mb-3 text-sm font-medium text-slate-500">
        Bon de livraison
      </h2>
      {hasFile && displayUrl && (
        <p className="mb-3">
          <a
            href={displayUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-slate-800 underline"
          >
            Voir le fichier BL
          </a>
        </p>
      )}
      {readOnly && hasFile && !displayUrl && (
        <p className="text-sm text-slate-500">Fichier BL enregistré (lien non disponible).</p>
      )}
      {!readOnly && (
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,image/*"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setError(null);
              setSuccess(false);
            }}
            disabled={loading}
            className="block w-full text-sm text-slate-600 file:mr-2 file:rounded file:border-0 file:bg-slate-200 file:px-3 file:py-1 file:text-sm"
          />
          {file && (
            <p className="text-xs text-slate-600">
              Fichier sélectionné : {file.name}
            </p>
          )}
          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
          {success && (
            <p className="text-sm text-emerald-600">
              Fichier BL enregistré.
            </p>
          )}
          <button
            type="submit"
            disabled={loading || !file}
            className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {loading ? "Upload en cours…" : "Enregistrer le fichier BL"}
          </button>
        </form>
      )}
    </div>
  );
}