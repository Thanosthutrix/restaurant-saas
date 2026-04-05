"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { reopenSettledDiningOrder } from "@/app/salle/actions";
import { uiError } from "@/components/ui/premium";

const CONFIRM =
  "Dévalider l’encaissement ? Le stock sera réintégré (méthode FIFO), le service et les ventes associés seront supprimés, et vous pourrez modifier les lignes puis encaisser à nouveau.";

type Props = {
  restaurantId: string;
  orderId: string;
};

export function ReopenSettledDiningOrderButton({ restaurantId, orderId }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handle = () => {
    if (!window.confirm(CONFIRM)) return;
    setError(null);
    startTransition(async () => {
      const res = await reopenSettledDiningOrder({ restaurantId, orderId });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="space-y-2">
      {error ? <p className={uiError}>{error}</p> : null}
      <button
        type="button"
        disabled={pending}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          handle();
        }}
        className="w-full rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-2.5 text-sm font-semibold text-amber-950 transition hover:bg-amber-100 disabled:opacity-50"
      >
        Dévalider l’encaissement (modifier la commande)
      </button>
    </div>
  );
}
