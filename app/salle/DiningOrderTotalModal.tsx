"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  applyGlobalDiningOrderDiscount,
  recordDiningOrderPartialPayment,
} from "@/app/salle/actions";
import type { DiningDiscountKind } from "@/lib/dining/lineDiscount";
import {
  DINING_PAYMENT_METHODS,
  type DiningPaymentMethod,
} from "@/lib/dining/diningPaymentMethods";
import { PAYMENT_SHORT, fmtEur } from "@/components/dining/DiningOrderTicketUi";
import { uiBtnOutlineSm, uiBtnPrimary, uiError, uiLabel, uiLead } from "@/components/ui/premium";

import type { OrderTicketSnapshot } from "@/lib/dining/orderTicketSnapshot";

type Tab = "discount" | "split" | "payment";

type Props = {
  restaurantId: string;
  orderId: string;
  open: boolean;
  totalTtc: number;
  amountPaidTtc: number;
  paymentMethod: DiningPaymentMethod;
  onPaymentMethod: (m: DiningPaymentMethod) => void;
  onClose: () => void;
  onApplied: (update?: OrderTicketSnapshot | { amountPaidTtc: number; amountDueTtc: number }) => void;
};

function parseNum(raw: string): number | null {
  const t = raw.trim().replace(/\s/g, "").replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export function DiningOrderTotalModal({
  restaurantId,
  orderId,
  open,
  totalTtc,
  amountPaidTtc,
  paymentMethod,
  onPaymentMethod,
  onClose,
  onApplied,
}: Props) {
  const [tab, setTab] = useState<Tab>("discount");
  const [kind, setKind] = useState<DiningDiscountKind>("none");
  const [percentStr, setPercentStr] = useState("");
  const [amountStr, setAmountStr] = useState("");
  const [guestsStr, setGuestsStr] = useState("2");
  const [exactPayStr, setExactPayStr] = useState("");
  const [partialPayStr, setPartialPayStr] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const amountDueTtc = useMemo(
    () => Math.max(0, round2(totalTtc - amountPaidTtc)),
    [totalTtc, amountPaidTtc]
  );

  useEffect(() => {
    if (!open) return;
    setTab("discount");
    setKind("none");
    setPercentStr("");
    setAmountStr("");
    setGuestsStr("2");
    setExactPayStr("");
    setPartialPayStr("");
    setError(null);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const guests = Math.max(2, Math.floor(parseNum(guestsStr) ?? 2));
  const perGuest = guests > 0 ? round2(amountDueTtc / guests) : 0;
  const exactPay = parseNum(exactPayStr);
  const remainderAfterExact =
    exactPay != null && exactPay > 0 ? Math.max(0, round2(amountDueTtc - exactPay)) : null;
  const othersCount = Math.max(1, guests - 1);
  const perOtherAfterExact =
    remainderAfterExact != null && othersCount > 0
      ? round2(remainderAfterExact / othersCount)
      : null;

  if (!open) return null;

  const applyDiscount = () => {
    setError(null);
    let discountValue: number | null = null;
    if (kind === "percent") {
      const p = parseNum(percentStr);
      if (p == null) {
        setError("Indiquez un pourcentage.");
        return;
      }
      discountValue = p;
    } else if (kind === "amount") {
      const a = parseNum(amountStr);
      if (a == null) {
        setError("Indiquez un montant.");
        return;
      }
      discountValue = a;
    }

    startTransition(async () => {
      const res = await applyGlobalDiningOrderDiscount({
        restaurantId,
        orderId,
        kind,
        discountValue,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onApplied(res.data);
      onClose();
    });
  };

  const recordPayment = (amount: number) => {
    setError(null);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Indiquez un montant positif.");
      return;
    }

    startTransition(async () => {
      const res = await recordDiningOrderPartialPayment({
        restaurantId,
        orderId,
        paymentMethod,
        amountTtc: amount,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onApplied(res.data);
      onClose();
    });
  };

  const recordPartialFromForm = () => {
    const a = parseNum(partialPayStr);
    if (a == null) {
      setError("Indiquez un montant à encaisser.");
      return;
    }
    recordPayment(a);
  };

  const tabBtn = (id: Tab, label: string) => (
    <button
      key={id}
      type="button"
      disabled={pending}
      onClick={() => {
        setTab(id);
        setError(null);
      }}
      className={
        tab === id
          ? "rounded-xl bg-copper-700 px-3 py-1.5 text-sm font-semibold text-white shadow-sm"
          : "rounded-xl border border-stone-200 bg-white px-3 py-1.5 text-sm font-semibold text-stone-700 shadow-sm hover:bg-stone-50"
      }
    >
      {label}
    </button>
  );

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-stone-900/40 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Total et encaissement"
      onClick={onClose}
    >
      <div
        className="max-h-[min(90vh,640px)] w-full max-w-md overflow-y-auto rounded-2xl border border-stone-200 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5">
          <h2 className="text-lg font-semibold text-stone-900">Total &amp; partage</h2>
          <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
            <span className="text-stone-600">
              Total : <span className="font-semibold text-stone-900">{fmtEur(totalTtc)}</span>
            </span>
            {amountPaidTtc > 0 ? (
              <span className="text-emerald-800">
                Payé : <span className="font-semibold">{fmtEur(amountPaidTtc)}</span>
              </span>
            ) : null}
            <span className="font-semibold text-copper-800">
              Reste : {fmtEur(amountDueTtc)}
            </span>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {tabBtn("discount", "Remise globale")}
            {tabBtn("split", "Diviser")}
            {tabBtn("payment", "Paiement partiel")}
          </div>

          {tab === "discount" ? (
            <div className="mt-4">
              <p className={`text-sm ${uiLead}`}>
                Applique une remise sur toutes les lignes du ticket (remplace les remises ligne par
                ligne).
              </p>
              <p className={`mt-3 ${uiLabel}`}>Type</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {(
                  [
                    ["none", "Aucune"],
                    ["percent", "%"],
                    ["amount", "Montant"],
                    ["free", "Offert"],
                  ] as const
                ).map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    disabled={pending}
                    onClick={() => setKind(k)}
                    className={
                      kind === k
                        ? "rounded-xl bg-copper-700 px-3 py-1.5 text-sm font-semibold text-white shadow-sm"
                        : "rounded-xl border border-stone-200 bg-white px-3 py-1.5 text-sm font-semibold text-stone-700 shadow-sm hover:bg-stone-50"
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>

              {kind === "percent" ? (
                <div className="mt-4">
                  <label className={uiLabel} htmlFor="global-disc-pct">
                    Pourcentage sur tout le ticket
                  </label>
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      id="global-disc-pct"
                      type="number"
                      min={0}
                      max={100}
                      step={0.5}
                      value={percentStr}
                      onChange={(e) => setPercentStr(e.target.value)}
                      className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm font-medium text-stone-900"
                      disabled={pending}
                    />
                    <span className="text-sm text-stone-500">%</span>
                  </div>
                </div>
              ) : null}

              {kind === "amount" ? (
                <div className="mt-4">
                  <label className={uiLabel} htmlFor="global-disc-amt">
                    Montant TTC total à déduire
                  </label>
                  <input
                    id="global-disc-amt"
                    type="text"
                    inputMode="decimal"
                    placeholder="ex. 5,00"
                    value={amountStr}
                    onChange={(e) => setAmountStr(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm font-medium text-stone-900"
                    disabled={pending}
                  />
                </div>
              ) : null}

              <div className="mt-6 flex flex-wrap justify-end gap-2">
                <button type="button" className={uiBtnOutlineSm} disabled={pending} onClick={onClose}>
                  Fermer
                </button>
                <button type="button" className={uiBtnPrimary} disabled={pending} onClick={applyDiscount}>
                  Appliquer
                </button>
              </div>
            </div>
          ) : null}

          {tab === "split" ? (
            <div className="mt-4 space-y-4">
              <p className={`text-sm ${uiLead}`}>
                Calculateur de partage sur le reste à payer ({fmtEur(amountDueTtc)}).
              </p>

              <div>
                <label className={uiLabel} htmlFor="split-guests">
                  Nombre de convives
                </label>
                <input
                  id="split-guests"
                  type="number"
                  min={2}
                  step={1}
                  value={guestsStr}
                  onChange={(e) => setGuestsStr(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm font-medium text-stone-900"
                  disabled={pending}
                />
                <p className="mt-2 rounded-xl border border-stone-100 bg-stone-50 px-3 py-2 text-sm text-stone-800">
                  Part égale :{" "}
                  <span className="font-bold tabular-nums text-copper-800">{fmtEur(perGuest)}</span>{" "}
                  par personne ({guests} convives)
                </p>
              </div>

              <div className="rounded-xl border border-copper-100 bg-copper-50/50 p-3">
                <p className={`${uiLabel}`}>Un convive paie un montant exact</p>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="ex. 25,00"
                  value={exactPayStr}
                  onChange={(e) => setExactPayStr(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-stone-900"
                  disabled={pending || amountDueTtc <= 0}
                />
                {exactPay != null && exactPay > 0 ? (
                  <div className="mt-3 space-y-1 text-sm text-stone-800">
                    {exactPay > amountDueTtc + 0.009 ? (
                      <p className="text-rose-700">Montant supérieur au reste dû.</p>
                    ) : (
                      <>
                        <p>
                          Reste à partager :{" "}
                          <span className="font-semibold tabular-nums">
                            {fmtEur(remainderAfterExact ?? 0)}
                          </span>
                        </p>
                        {guests > 1 && perOtherAfterExact != null ? (
                          <p>
                            Pour les {othersCount} autre{othersCount > 1 ? "s" : ""} convive
                            {othersCount > 1 ? "s" : ""} :{" "}
                            <span className="font-bold tabular-nums text-copper-800">
                              {fmtEur(perOtherAfterExact)}
                            </span>{" "}
                            chacun
                          </p>
                        ) : null}
                        <button
                          type="button"
                          className={`${uiBtnPrimary} mt-3 w-full`}
                          disabled={pending || exactPay > amountDueTtc + 0.009}
                          onClick={() => recordPayment(exactPay)}
                        >
                          Enregistrer ce paiement ({fmtEur(exactPay)})
                        </button>
                      </>
                    )}
                  </div>
                ) : null}
              </div>

              <div className="flex justify-end">
                <button type="button" className={uiBtnOutlineSm} disabled={pending} onClick={onClose}>
                  Fermer
                </button>
              </div>
            </div>
          ) : null}

          {tab === "payment" ? (
            <div className="mt-4 space-y-4">
              <p className={`text-sm ${uiLead}`}>
                Enregistre un paiement sans clôturer la table. Le solde reste ouvert jusqu’à
                l’encaissement final.
              </p>

              <div>
                <p className={uiLabel}>Mode de paiement</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {DINING_PAYMENT_METHODS.map((m) => (
                    <button
                      key={m}
                      type="button"
                      disabled={pending}
                      onClick={() => onPaymentMethod(m)}
                      className={
                        paymentMethod === m
                          ? "rounded-xl bg-copper-700 px-3 py-1.5 text-sm font-semibold text-white shadow-sm"
                          : "rounded-xl border border-stone-200 bg-white px-3 py-1.5 text-sm font-semibold text-stone-700 shadow-sm hover:bg-stone-50"
                      }
                    >
                      {PAYMENT_SHORT[m]}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className={uiLabel} htmlFor="partial-amt">
                  Montant encaissé maintenant
                </label>
                <input
                  id="partial-amt"
                  type="text"
                  inputMode="decimal"
                  placeholder={`max. ${amountDueTtc.toFixed(2).replace(".", ",")}`}
                  value={partialPayStr}
                  onChange={(e) => setPartialPayStr(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm font-medium text-stone-900"
                  disabled={pending || amountDueTtc <= 0}
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  {[0.25, 0.5, 1].map((frac) => {
                    const preset = round2(amountDueTtc * frac);
                    if (preset <= 0) return null;
                    return (
                      <button
                        key={frac}
                        type="button"
                        disabled={pending}
                        onClick={() => setPartialPayStr(preset.toFixed(2).replace(".", ","))}
                        className="rounded-lg border border-stone-200 bg-white px-2.5 py-1 text-xs font-semibold text-stone-700 hover:bg-stone-50"
                      >
                        {frac === 1 ? "Tout le reste" : `${Math.round(frac * 100)} %`}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-wrap justify-end gap-2">
                <button type="button" className={uiBtnOutlineSm} disabled={pending} onClick={onClose}>
                  Fermer
                </button>
                <button
                  type="button"
                  className={uiBtnPrimary}
                  disabled={pending || amountDueTtc <= 0}
                  onClick={recordPartialFromForm}
                >
                  Enregistrer le paiement
                </button>
              </div>
            </div>
          ) : null}

          {error ? <p className={`mt-3 ${uiError}`}>{error}</p> : null}
        </div>
      </div>
    </div>
  );
}
