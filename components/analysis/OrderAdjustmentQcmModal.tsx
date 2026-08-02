"use client";

import { useState, useTransition } from "react";
import { AlertTriangle } from "lucide-react";
import { saveOrderAnomalyResponseAction } from "@/app/analysis/actions";
import { ORDER_ANOMALY_EXPLANATIONS, type OrderAdjustmentAnomalyType } from "@/lib/analysis/orderAnomalyTriggers";
import { Modal } from "@/components/ui/Modal";
import { uiBtnPrimary, uiBtnSecondary, uiError, uiInput, uiLead } from "@/components/ui/premium";

export type PendingOrderAnomaly = {
  supplierId: string;
  inventoryItemId: string;
  itemName: string;
  suggestedQty: number;
  adjustedQty: number;
  theoreticalStockQty: number;
  anomalyType: OrderAdjustmentAnomalyType;
  orderDraftId?: string | null;
  orderDraftLineId?: string | null;
  source?: "order_draft" | "suggestion";
};

type Props = {
  open: boolean;
  restaurantId: string;
  anomaly: PendingOrderAnomaly | null;
  onClose: () => void;
  onConfirmed: (adjustedQty: number) => void;
};

export function OrderAdjustmentQcmModal({ open, restaurantId, anomaly, onClose, onConfirmed }: Props) {
  const [explanationCode, setExplanationCode] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!open || !anomaly) return null;

  const title =
    anomaly.anomalyType === "decrease_while_theo_zero"
      ? "Commande réduite — stock théorique à zéro"
      : "Commande augmentée — stock théorique positif";

  const subtitle = `${anomaly.itemName} · suggéré ${anomaly.suggestedQty} → ${anomaly.adjustedQty} · stock théo ${anomaly.theoreticalStockQty}`;

  const confirm = () => {
    if (!explanationCode) {
      setError("Choisissez une explication.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await saveOrderAnomalyResponseAction({
        restaurantId,
        orderDraftId: anomaly.orderDraftId ?? null,
        orderDraftLineId: anomaly.orderDraftLineId ?? null,
        inventoryItemId: anomaly.inventoryItemId,
        anomalyType: anomaly.anomalyType,
        suggestedQty: anomaly.suggestedQty,
        adjustedQty: anomaly.adjustedQty,
        theoreticalStockQty: anomaly.theoreticalStockQty,
        explanationCode,
        explanationNote: note.trim() || null,
        source: anomaly.source ?? "order_draft",
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onConfirmed(anomaly.adjustedQty);
      setExplanationCode("");
      setNote("");
      onClose();
    });
  };

  return (
    <Modal
      title={title}
      subtitle={subtitle}
      icon={AlertTriangle}
      tone="bg-amber-50 text-amber-800"
      onClose={onClose}
      footer={
        <>
          <button type="button" className={uiBtnSecondary} onClick={onClose} disabled={pending}>
            Annuler
          </button>
          <button type="button" className={uiBtnPrimary} onClick={confirm} disabled={pending}>
            {pending ? "Enregistrement…" : "Confirmer l'ajustement"}
          </button>
        </>
      }
    >
      <p className={uiLead}>
        {anomaly.anomalyType === "decrease_while_theo_zero"
          ? "Vous réduisez la commande alors que le stock théorique est à zéro. Quelle est la raison ?"
          : "Vous augmentez la commande alors qu'il reste du stock théorique. Quelle est la raison ?"}
      </p>
      <div className="mt-4 space-y-2">
        {ORDER_ANOMALY_EXPLANATIONS.map((opt) => (
          <label
            key={opt.code}
            className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition ${
              explanationCode === opt.code
                ? "border-copper-400 bg-copper-50"
                : "border-stone-200 bg-white hover:border-stone-300"
            }`}
          >
            <input
              type="radio"
              name="anomaly-explanation"
              value={opt.code}
              checked={explanationCode === opt.code}
              onChange={() => setExplanationCode(opt.code)}
              className="accent-copper-700"
            />
            {opt.label}
          </label>
        ))}
      </div>
      {explanationCode === "other" ? (
        <input
          className={uiInput + " mt-3 w-full"}
          placeholder="Précisez…"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      ) : null}
      {error ? <p className={uiError + " mt-3"}>{error}</p> : null}
    </Modal>
  );
}
