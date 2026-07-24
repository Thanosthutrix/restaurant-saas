"use client";

import { useEffect, useState, useTransition } from "react";
import { setDiningOrderLineDiscount } from "@/app/salle/actions";
import type { DiningLineClient } from "@/app/salle/commande/diningOrderTypes";
import type { DiningDiscountKind } from "@/lib/dining/lineDiscount";
import { uiBtnOutlineSm, uiBtnPrimary, uiError, uiLabel, uiLead } from "@/components/ui/premium";
import { ModalOverlay } from "@/components/ui/ModalOverlay";

import type { OrderTicketSnapshot } from "@/lib/dining/orderTicketSnapshot";

type Props = {
  restaurantId: string;
  line: DiningLineClient | null;
  onClose: () => void;
  onApplied: (ticket?: OrderTicketSnapshot) => void;
};

function fmtEur(n: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);
}

function parseNum(raw: string): number | null {
  const t = raw.trim().replace(/\s/g, "").replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function DiningLineDiscountModal({ restaurantId, line, onClose, onApplied }: Props) {
  const [kind, setKind] = useState<DiningDiscountKind>("none");
  const [percentStr, setPercentStr] = useState("");
  const [amountStr, setAmountStr] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!line) return;
    setKind(line.discountKind);
    setPercentStr(
      line.discountKind === "percent" && line.discountValue != null ? String(line.discountValue) : ""
    );
    setAmountStr(
      line.discountKind === "amount" && line.discountValue != null
        ? String(line.discountValue).replace(".", ",")
        : ""
    );
    setError(null);
  }, [line]);

  if (!line) return null;

  const apply = () => {
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
      const res = await setDiningOrderLineDiscount({
        restaurantId,
        lineId: line.id,
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

  return (
    <ModalOverlay zIndex={60} ariaLabel="Remise" onClose={onClose}>
      <div className="w-full max-w-sm rounded-2xl border border-stone-200 bg-white shadow-xl">
        <div className="p-5">
          <h2 className="text-lg font-semibold text-stone-900">Remise</h2>
          <p className={`mt-1 text-sm ${uiLead}`}>{line.dishName}</p>
          <p className="mt-2 text-sm text-stone-600">
            Sous-total catalogue :{" "}
            <span className="font-semibold text-stone-900">{fmtEur(line.lineGrossTtc)}</span>
            <span className="text-stone-500"> · Qté {line.qty}</span>
          </p>

          <p className={`mt-4 ${uiLabel}`}>Type</p>
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
              <label className={uiLabel} htmlFor="disc-pct">
                Pourcentage
              </label>
              <div className="mt-1 flex items-center gap-2">
                <input
                  id="disc-pct"
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
              <label className={uiLabel} htmlFor="disc-amt">
                Montant TTC à déduire
              </label>
              <input
                id="disc-amt"
                type="text"
                inputMode="decimal"
                placeholder="ex. 2,50"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm font-medium text-stone-900"
                disabled={pending}
              />
            </div>
          ) : null}

          {error ? <p className={`mt-3 ${uiError}`}>{error}</p> : null}

          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <button type="button" className={uiBtnOutlineSm} disabled={pending} onClick={onClose}>
              Annuler
            </button>
            <button type="button" className={uiBtnPrimary} disabled={pending} onClick={apply}>
              Enregistrer
            </button>
          </div>
        </div>
      </div>
    </ModalOverlay>
  );
}
