"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { Dish } from "@/lib/db";
import type { ServiceType } from "@/lib/constants";
import { SERVICE_TYPES } from "@/lib/constants";
import {
  addDishToDiningOrder,
  removeDiningOrderLine,
  setDiningOrderLineQty,
  settleDiningOrder,
  type PaymentMethod,
} from "@/app/salle/actions";
import type { DiningLineClient } from "../diningOrderTypes";
import {
  uiBtnOutlineSm,
  uiBtnPrimary,
  uiCard,
  uiError,
  uiLabel,
  uiLead,
  uiSelect,
  uiSectionTitleSm,
  uiSuccess,
} from "@/components/ui/premium";

const SERVICE_LABEL_FR: Record<ServiceType, string> = {
  lunch: "Midi",
  dinner: "Soir",
};

const PAYMENT_LABEL_FR: Record<PaymentMethod, string> = {
  cash: "Espèces",
  card: "Carte",
  other: "Autre",
};

type Props = {
  restaurantId: string;
  orderId: string;
  status: "open" | "settled";
  serviceId: string | null;
  placeDescription: string;
  lines: DiningLineClient[];
  totalTtc: number;
  dishes: Dish[];
};

export function DiningOrderClient({
  restaurantId,
  orderId,
  status,
  serviceId,
  placeDescription,
  lines,
  totalTtc,
  dishes,
}: Props) {
  const router = useRouter();
  const [dishToAdd, setDishToAdd] = useState(dishes[0]?.id ?? "");
  const [serviceType, setServiceType] = useState<ServiceType>("lunch");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("card");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const syncFromServer = () => {
    router.refresh();
  };

  const fmt = (n: number) =>
    new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);

  const adjustLine = (lineId: string, delta: number) => {
    const line = lines.find((l) => l.id === lineId);
    if (!line) return;
    const next = line.qty + delta;
    if (next <= 0) return;
    setError(null);
    startTransition(async () => {
      const res = await setDiningOrderLineQty({ restaurantId, lineId, qty: next });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      syncFromServer();
    });
  };

  const removeLine = (lineId: string) => {
    setError(null);
    startTransition(async () => {
      const res = await removeDiningOrderLine({ restaurantId, lineId });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      syncFromServer();
    });
  };

  const addDish = () => {
    if (!dishToAdd) return;
    setError(null);
    startTransition(async () => {
      const res = await addDishToDiningOrder({
        restaurantId,
        orderId,
        dishId: dishToAdd,
        qty: 1,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      syncFromServer();
    });
  };

  const handleSettle = () => {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const res = await settleDiningOrder({
        restaurantId,
        orderId,
        serviceType,
        paymentMethod,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSuccess(`Encaissement enregistré (${fmt(res.data?.totalTtc ?? 0)}).`);
      syncFromServer();
    });
  };

  if (status === "settled") {
    return (
      <div className={`${uiCard} space-y-4`}>
        <p className={uiLead}>Cette commande ({placeDescription}) a été encaissée.</p>
        <p className="text-lg font-semibold text-slate-900">Total TTC : {fmt(totalTtc)}</p>
        {serviceId ? (
          <p>
            <Link
              href={`/service/${serviceId}`}
              className="text-sm font-semibold text-indigo-600 hover:text-indigo-500"
            >
              Voir le service et le stock →
            </Link>
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error ? <p className={uiError}>{error}</p> : null}
      {success ? <p className={uiSuccess}>{success}</p> : null}

      <div className={`${uiCard} space-y-3`}>
        <p className={uiSectionTitleSm}>Ajouter un plat</p>
        <div className="flex flex-wrap gap-2">
          <select
            className={uiSelect}
            value={dishToAdd}
            onChange={(e) => setDishToAdd(e.target.value)}
            disabled={pending || dishes.length === 0}
          >
            {dishes.length === 0 ? (
              <option value="">Aucun plat</option>
            ) : (
              dishes.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                  {d.selling_price_ttc != null
                    ? ` — ${fmt(Number(d.selling_price_ttc))}`
                    : ""}
                </option>
              ))
            )}
          </select>
          <button type="button" className={uiBtnPrimary} disabled={pending || !dishToAdd} onClick={addDish}>
            Ajouter
          </button>
        </div>
        {dishes.length === 0 ? (
          <p className={uiLead}>
            <Link href="/dishes" className="font-semibold text-indigo-600">
              Créer des plats
            </Link>{" "}
            pour prendre des commandes.
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <p className={uiSectionTitleSm}>Lignes</p>
        {lines.length === 0 ? (
          <p className={uiLead}>Aucune ligne pour l’instant.</p>
        ) : (
          <ul className="space-y-2">
            {lines.map((l) => (
              <li
                key={l.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-sm"
              >
                <div className="min-w-0">
                  <p className="font-medium text-slate-900">{l.dishName}</p>
                  <p className="text-sm text-slate-500">
                    {fmt(l.lineTotalTtc)} · Qté {l.qty}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  <button
                    type="button"
                    className={uiBtnOutlineSm}
                    disabled={pending}
                    onClick={() => adjustLine(l.id, -1)}
                  >
                    −
                  </button>
                  <button
                    type="button"
                    className={uiBtnOutlineSm}
                    disabled={pending}
                    onClick={() => adjustLine(l.id, 1)}
                  >
                    +
                  </button>
                  <button
                    type="button"
                    className={uiBtnOutlineSm}
                    disabled={pending}
                    onClick={() => removeLine(l.id)}
                  >
                    Retirer
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 px-4 py-3">
        <p className="text-lg font-semibold text-slate-900">Total TTC : {fmt(totalTtc)}</p>
      </div>

      <div className={`${uiCard} space-y-4`}>
        <p className={uiSectionTitleSm}>Encaisser</p>
        <div>
          <p className={uiLabel}>Service</p>
          <div className="mt-1 flex flex-wrap gap-2">
            {SERVICE_TYPES.map((st) => (
              <button
                key={st}
                type="button"
                disabled={pending}
                onClick={() => setServiceType(st)}
                className={
                  serviceType === st
                    ? "rounded-xl bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm"
                    : "rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                }
              >
                {SERVICE_LABEL_FR[st]}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className={uiLabel}>Paiement</p>
          <select
            className={`${uiSelect} mt-1 w-full max-w-xs`}
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
            disabled={pending}
          >
            {(Object.keys(PAYMENT_LABEL_FR) as PaymentMethod[]).map((m) => (
              <option key={m} value={m}>
                {PAYMENT_LABEL_FR[m]}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          className={uiBtnPrimary}
          disabled={pending || lines.length === 0}
          onClick={handleSettle}
        >
          Valider l’encaissement
        </button>
        <p className={`text-xs ${uiLead}`}>
          Un service est créé, les ventes et le stock sont mis à jour comme pour un relevé manuel.
        </p>
      </div>
    </div>
  );
}
