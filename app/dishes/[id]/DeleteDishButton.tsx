"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { deleteDish } from "./actions";

type Props = { dishId: string; restaurantId: string; dishName: string };

export function DeleteDishButton({ dishId, restaurantId, dishName }: Props) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm("Supprimer le plat « " + dishName + " » ? Cette action est irréversible.")) return;
    setDeleting(true);
    const result = await deleteDish({ restaurantId, dishId });
    setDeleting(false);
    if (result.ok) router.push("/dishes");
    else alert(result.error);
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={deleting}
      className="mt-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-800 shadow-sm transition hover:bg-rose-100 disabled:opacity-50"
    >
      {deleting ? "Suppression…" : "Supprimer le plat"}
    </button>
  );
}
