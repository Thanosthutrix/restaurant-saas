"use client";

import { useState } from "react";
import { deleteServiceAction } from "./actions";

type Props = { serviceId: string };

export function DeleteServiceButton({ serviceId }: Props) {
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm("Supprimer ce service ? Les ventes seront supprimées et le stock sera remis à jour automatiquement. Cette action est irréversible.")) return;
    setDeleting(true);
    const result = await deleteServiceAction(serviceId);
    setDeleting(false);
    if (!result.ok) alert(result.error);
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={deleting}
      className="rounded border border-red-200 bg-red-50 px-3 py-1.5 text-sm text-red-700 hover:bg-red-100 disabled:opacity-50"
    >
      {deleting ? "Suppression…" : "Supprimer le service"}
    </button>
  );
}
