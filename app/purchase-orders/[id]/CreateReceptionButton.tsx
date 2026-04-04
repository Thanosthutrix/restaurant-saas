"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

export default function CreateReceptionButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  async function handleClick() {
    startTransition(async () => {
      const res = await fetch(`/api/receiving/create-from-order/${orderId}`, {
        method: "POST",
      });

      const data = await res.json();

      if (res.ok && data?.id) {
        router.push(`/receiving/${data.id}`);
      } else {
        // eslint-disable-next-line no-alert
        alert(data?.error ?? "Erreur lors de la création de la réception");
      }
    });
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={handleClick}
      className="rounded bg-emerald-700 px-3 py-2 text-white"
    >
      {pending ? "Création..." : "Créer une réception"}
    </button>
  );
}

