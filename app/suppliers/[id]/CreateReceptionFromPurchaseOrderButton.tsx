"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

function isValidPurchaseOrderId(id: string | undefined | null): boolean {
  return typeof id === "string" && id !== "undefined" && id.trim() !== "";
}

export function CreateReceptionFromPurchaseOrderButton({
  purchaseOrderId,
}: {
  purchaseOrderId: string | undefined;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const validId = isValidPurchaseOrderId(purchaseOrderId);

  function handleClick() {
    if (!validId) return;
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/receiving/create-from-order/${purchaseOrderId}`, {
          method: "POST",
        });
        let data: unknown = null;
        try {
          data = await res.json();
        } catch {
          /* ignore */
        }
        const parsed = data && typeof data === "object" ? (data as Record<string, unknown>) : null;
        const id = parsed?.id;
        const apiError = parsed?.error;
        if (res.ok && typeof id === "string" && id) {
          router.push(`/receiving/${id}`);
          return;
        }
        const message =
          (typeof apiError === "string" ? apiError : null) ??
          (res.status === 404
            ? "Route de création de réception introuvable."
            : "Erreur lors de la création de la réception.");
        setError(message);
      } catch (e: unknown) {
        const msg =
          e && typeof e === "object" && "message" in e
            ? String((e as { message?: unknown }).message)
            : null;
        setError(msg ?? "Erreur réseau lors de la création de la réception.");
      }
    });
  }

  if (!validId) {
    return (
      <span className="text-xs text-red-600">
        Commande fournisseur invalide
      </span>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={handleClick}
        aria-busy={pending}
        className="rounded border border-emerald-600 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Création…" : "Créer une réception"}
      </button>
      {error && (
        <p className="max-w-xs text-right text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
