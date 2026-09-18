"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  deliveryNoteId: string;
  restaurantId: string;
  status: string;
  fileName: string | null;
  filePath: string | null;
};

type AnalyzeOk = {
  ok: true;
  insertedCount: number;
  rawLineCount: number;
  userMessage: string;
};

export function BlAnalyzeButton({ deliveryNoteId, restaurantId, status, fileName, filePath }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ message: string; warning: boolean } | null>(null);
  const [pending, setPending] = useState(false);

  if (status !== "draft") return null;
  if (!filePath && !fileName) return null;

  const isPdf = fileName?.toLowerCase().endsWith(".pdf") ?? false;

  if (isPdf) {
    return (
      <div className="mb-4 rounded-lg border border-amber-100 bg-amber-50/80 px-3 py-2 text-sm text-amber-950">
        La lecture automatique du BL nécessite une <strong>photo</strong> (JPG, PNG). Les PDF ne sont pas pris en charge
        pour l’instant.
      </div>
    );
  }

  return (
    <div className="mb-4 rounded-lg border border-copper-100 bg-copper-50/50 px-3 py-3">
      <p className="text-sm text-stone-800">
        <span className="font-medium text-copper-950">Lecture du BL (OpenAI)</span> — extrait libellé, quantité et
        prix HT depuis une <strong>photo nette</strong> du tableau articles, puis propose un rattachement au{" "}
        <strong>produit stock</strong> (nom proche ou alias mémorisé pour ce fournisseur). Peut prendre jusqu’à une
        minute ; ne fermez pas l’onglet.
      </p>
      <p className="mt-2 text-xs text-stone-500">
        Cadrez le tableau (désignation + quantités visibles). Si une ligne n’est pas reconnue, choisissez le produit dans
        la liste — le lien sera mémorisé pour les prochains BL de ce fournisseur.
      </p>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setError(null);
          setResult(null);
          setPending(true);
          void (async () => {
            try {
              const r = await fetch("/api/receiving/analyze-bl", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ deliveryNoteId, restaurantId }),
              });
              const data = (await r.json()) as { ok: false; error?: string } | AnalyzeOk;
              if (!data.ok) {
                setError(data.error ?? "Échec de la lecture.");
                return;
              }
              setResult({
                message: data.userMessage,
                warning: data.insertedCount === 0,
              });
              router.refresh();
            } catch {
              setError("Erreur réseau ou délai dépassé. Réessayez.");
            } finally {
              setPending(false);
            }
          })();
        }}
        className="mt-3 rounded-lg border border-copper-200 bg-white px-3 py-2 text-sm font-medium text-copper-900 shadow-sm hover:bg-copper-50 disabled:opacity-50"
      >
        {pending ? "Lecture en cours (patience)…" : "Lire le BL et remplir les lignes"}
      </button>
      {error ? (
        <p className="mt-2 text-sm text-rose-700" role="alert">
          {error}
        </p>
      ) : null}
      {result ? (
        <p
          className={`mt-2 rounded-md border px-3 py-2 text-sm ${
            result.warning
              ? "border-amber-200 bg-amber-50 text-amber-950"
              : "border-emerald-200 bg-emerald-50 text-emerald-950"
          }`}
          role="status"
        >
          {result.message}
        </p>
      ) : null}
    </div>
  );
}
