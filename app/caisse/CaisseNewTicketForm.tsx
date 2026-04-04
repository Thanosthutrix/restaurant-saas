"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createCounterDiningOrder } from "./actions";
import { uiBtnPrimary, uiBtnSecondary, uiCard, uiError, uiInput, uiLabel } from "@/components/ui/premium";

type Props = { restaurantId: string };

export function CaisseNewTicketForm({ restaurantId }: Props) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const goToOrder = (orderId: string) => {
    router.push(`/salle/commande/${orderId}?from=caisse`);
  };

  const openNamed = () => {
    setError(null);
    startTransition(async () => {
      const res = await createCounterDiningOrder({ restaurantId, ticketLabel: name });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setName("");
      goToOrder(res.data!.orderId);
    });
  };

  const openQuick = () => {
    setError(null);
    startTransition(async () => {
      const res = await createCounterDiningOrder({ restaurantId, quick: true });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      goToOrder(res.data!.orderId);
    });
  };

  return (
    <div className={`${uiCard} space-y-3`}>
      <p className={uiLabel}>Nouveau ticket comptoir</p>
      <p className="text-sm text-slate-500">
        Ouvrir une commande à un nom (à emporter, bar…) ou une vente rapide sans saisie.
      </p>
      <div className="flex flex-wrap gap-2">
        <input
          className={`${uiInput} min-w-[12rem] flex-1`}
          placeholder="Nom ou repère du ticket"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={pending}
          onKeyDown={(e) => {
            if (e.key === "Enter") openNamed();
          }}
        />
        <button type="button" className={uiBtnPrimary} disabled={pending} onClick={openNamed}>
          Ouvrir au nom
        </button>
        <button type="button" className={uiBtnSecondary} disabled={pending} onClick={openQuick}>
          Vente rapide
        </button>
      </div>
      {error ? <p className={uiError}>{error}</p> : null}
    </div>
  );
}
