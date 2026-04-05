"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createCounterDiningOrder } from "./actions";
import { CAISSE_QUICK_COUNTER_STORAGE_KEY } from "./caisseQuickStorage";
import { uiBtnPrimary, uiError, uiInput } from "@/components/ui/premium";

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
      try {
        sessionStorage.removeItem(CAISSE_QUICK_COUNTER_STORAGE_KEY);
      } catch {
        /* ignore */
      }
      const res = await createCounterDiningOrder({ restaurantId, ticketLabel: name });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setName("");
      goToOrder(res.data!.orderId);
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-slate-200/80 pb-3">
      <input
        className={`${uiInput} min-w-[10rem] flex-1 py-2 text-sm`}
        placeholder="Ticket à un nom…"
        value={name}
        onChange={(e) => setName(e.target.value)}
        disabled={pending}
        onKeyDown={(e) => {
          if (e.key === "Enter") openNamed();
        }}
      />
      <button type="button" className={`${uiBtnPrimary} shrink-0 px-3 py-2 text-sm`} disabled={pending} onClick={openNamed}>
        Ouvrir
      </button>
      {error ? <p className={`${uiError} w-full text-xs`}>{error}</p> : null}
    </div>
  );
}
