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
} from "@/app/salle/actions";
import {
  DINING_PAYMENT_LABEL_FR,
  DINING_PAYMENT_METHODS,
  parseDiningPaymentMethod,
  type DiningPaymentMethod,
} from "@/lib/dining/diningPaymentMethods";
import { CancelOpenDiningOrderButton } from "@/app/salle/CancelOpenDiningOrderButton";
import { ReopenSettledDiningOrderButton } from "@/app/salle/ReopenSettledDiningOrderButton";
import { DiningLineDiscountModal } from "@/app/salle/DiningLineDiscountModal";
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

type Props = {
  restaurantId: string;
  orderId: string;
  status: "open" | "settled";
  serviceId: string | null;
  placeDescription: string;
  cancelRedirectHref: string;
  settledPaymentMethod?: string | null;
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
  cancelRedirectHref,
  settledPaymentMethod,
  lines,
  totalTtc,
  dishes,
}: Props) {
  const router = useRouter();
  const [dishToAdd, setDishToAdd] = useState(dishes[0]?.id ?? "");
  const [serviceType, setServiceType] = useState<ServiceType>("lunch");
  const [paymentMethod, setPaymentMethod] = useState<DiningPaymentMethod>("card");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [discountLine, setDiscountLine] = useState<DiningLineClient | null>(null);

  const syncFromServer = () => {
    router.refresh();
  };

  const fmt = (n: number) =>
    new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);

  const discountBadge = (l: DiningLineClient) => {
    if (l.discountKind === "none") return null;
    if (l.discountKind === "free") return "Offert";
    if (l.discountKind === "percent" && l.discountValue != null) return `−${l.discountValue}%`;
    if (l.discountKind === "amount" && l.discountValue != null) return `−${fmt(l.discountValue)}`;
    return "Remise";
  };

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
      <div className="space-y-6">
        <div className={`${uiCard} space-y-4`}>
          <p className={uiLead}>Cette commande ({placeDescription}) a été encaissée.</p>
          <p className="text-lg font-semibold text-slate-900">Total TTC : {fmt(totalTtc)}</p>
          <p className="text-sm text-slate-700">
            Paiement :{" "}
            <span className="font-semibold text-slate-900">
              {DINING_PAYMENT_LABEL_FR[parseDiningPaymentMethod(settledPaymentMethod)]}
            </span>
          </p>
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
        <div className={`${uiCard} space-y-2`}>
          <p className={`text-xs ${uiLead}`}>
            Pour modifier les lignes, le moyen de paiement ou le total, dévalidez l’encaissement : le
            stock et le service seront annulés, puis vous pourrez encaisser à nouveau avec le bon
            paiement.
          </p>
          <ReopenSettledDiningOrderButton restaurantId={restaurantId} orderId={orderId} />
        </div>
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
        <div>
          <p className={uiSectionTitleSm}>Lignes</p>
          <p className={`mt-1 text-xs ${uiLead}`}>Touchez une ligne pour appliquer une remise (%, montant ou offert).</p>
        </div>
        {lines.length === 0 ? (
          <p className={uiLead}>Aucune ligne pour l’instant.</p>
        ) : (
          <ul className="space-y-2">
            {lines.map((l) => (
              <li
                key={l.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-sm"
              >
                <button
                  type="button"
                  className="min-w-0 flex-1 rounded-xl px-0 py-0 text-left transition hover:bg-slate-50/90"
                  disabled={pending}
                  onClick={() => setDiscountLine(l)}
                >
                  <p className="font-medium text-slate-900">{l.dishName}</p>
                  <p className="text-sm text-slate-500">
                    {l.lineGrossTtc > l.lineTotalTtc + 0.001 ? (
                      <>
                        <span className="text-slate-400 line-through">{fmt(l.lineGrossTtc)}</span>
                        <span className="text-slate-400"> → </span>
                      </>
                    ) : null}
                    <span className="font-medium text-slate-800">{fmt(l.lineTotalTtc)}</span>
                    <span> · Qté {l.qty}</span>
                  </p>
                  {l.discountKind !== "none" ? (
                    <p className="mt-1 text-xs font-semibold text-amber-800">{discountBadge(l)}</p>
                  ) : null}
                </button>
                <div className="flex flex-shrink-0 flex-wrap items-center gap-1">
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
          <div className="mt-1 flex flex-wrap gap-2">
            {DINING_PAYMENT_METHODS.map((m) => (
              <button
                key={m}
                type="button"
                disabled={pending}
                onClick={() => setPaymentMethod(m)}
                className={
                  paymentMethod === m
                    ? "rounded-xl bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm"
                    : "rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                }
              >
                {DINING_PAYMENT_LABEL_FR[m]}
              </button>
            ))}
          </div>
        </div>
        <button
          type="button"
          className={uiBtnPrimary}
          disabled={pending || lines.length === 0 || totalTtc < 0}
          onClick={handleSettle}
        >
          Valider l’encaissement
        </button>
        <p className={`text-xs ${uiLead}`}>
          Un service est créé, les ventes et le stock sont mis à jour comme pour un relevé manuel.
        </p>
      </div>

      <div className="rounded-2xl border border-rose-100 bg-rose-50/30 px-4 py-4">
        <p className={`mb-2 text-xs ${uiLead}`}>
          Client parti sans commander, ou commande à annuler ? Aucune vente ni mouvement de stock.
        </p>
        <CancelOpenDiningOrderButton
          restaurantId={restaurantId}
          orderId={orderId}
          redirectHref={cancelRedirectHref}
          linesCount={lines.length}
          contextLabel={placeDescription}
        />
      </div>

      <DiningLineDiscountModal
        restaurantId={restaurantId}
        line={discountLine}
        onClose={() => setDiscountLine(null)}
        onApplied={syncFromServer}
      />
    </div>
  );
}
