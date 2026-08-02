"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { logWasteAction } from "@/app/analysis/actions";
import { ModalOverlay } from "@/components/ui/ModalOverlay";
import {
  uiBtnPrimary,
  uiBtnSecondary,
  uiError,
  uiInput,
  uiLabel,
  uiLead,
} from "@/components/ui/premium";
import type { WasteReason, WasteType } from "@/lib/analysis/types";

type InventoryOption = { id: string; name: string; unit: string };
type DishOption = { id: string; name: string };

const WASTE_TYPES: { value: WasteType; label: string; emoji: string }[] = [
  { value: "raw", label: "Brute", emoji: "🥬" },
  { value: "prep", label: "Prépa", emoji: "🍳" },
  { value: "plate", label: "Assiette", emoji: "🍽" },
];

const WASTE_REASONS: { value: WasteReason; label: string }[] = [
  { value: "dlc", label: "DLC" },
  { value: "cooking", label: "Cuisson" },
  { value: "dropped", label: "Tombé" },
  { value: "quality", label: "Qualité" },
  { value: "other", label: "Autre" },
];

type Props = {
  open: boolean;
  restaurantId: string;
  serviceId?: string | null;
  inventoryItems: InventoryOption[];
  dishes: DishOption[];
  onClose: () => void;
  onLogged?: () => void;
};

export function WasteQuickLogSheet({
  open,
  restaurantId,
  serviceId,
  inventoryItems,
  dishes,
  onClose,
  onLogged,
}: Props) {
  const [wasteType, setWasteType] = useState<WasteType | null>(null);
  const [reason, setReason] = useState<WasteReason | null>(null);
  const [inventoryItemId, setInventoryItemId] = useState("");
  const [dishId, setDishId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!open) return null;

  const selectedItem = inventoryItems.find((i) => i.id === inventoryItemId);
  const unit = selectedItem?.unit ?? "unit";

  const reset = () => {
    setWasteType(null);
    setReason(null);
    setInventoryItemId("");
    setDishId("");
    setQuantity("");
    setError(null);
  };

  const close = () => {
    reset();
    onClose();
  };

  const submit = () => {
    if (!wasteType || !reason) {
      setError("Choisissez le type et la raison.");
      return;
    }
    const qty = Number(quantity.replace(",", "."));
    if (!Number.isFinite(qty) || qty <= 0) {
      setError("Indiquez une quantité valide.");
      return;
    }
    if (wasteType !== "plate" && !inventoryItemId) {
      setError("Sélectionnez un composant stock.");
      return;
    }
    if (wasteType === "plate" && !dishId) {
      setError("Sélectionnez un plat.");
      return;
    }

    setError(null);
    startTransition(async () => {
      const res = await logWasteAction({
        restaurantId,
        serviceId,
        wasteType,
        reason,
        quantity: qty,
        unit,
        inventoryItemId: wasteType !== "plate" ? inventoryItemId : null,
        dishId: wasteType === "plate" ? dishId : null,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onLogged?.();
      close();
    });
  };

  const step = !wasteType ? 1 : !reason ? 2 : 3;

  return (
    <ModalOverlay onClose={close} ariaLabel="Enregistrer une perte">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-stone-200/80 bg-white shadow-2xl">
        <div className="border-b border-stone-100 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50 text-rose-700">
              <Trash2 className="h-4 w-4" aria-hidden />
            </span>
            <div>
              <p className="text-sm font-semibold text-stone-900">Enregistrer une perte</p>
              <p className={uiLead}>Étape {step}/3 · 2 clics</p>
            </div>
          </div>
        </div>

        <div className="space-y-4 px-4 py-4">
          {step === 1 ? (
            <>
              <p className={uiLabel}>Type de perte</p>
              <div className="grid grid-cols-3 gap-2">
                {WASTE_TYPES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    className="flex flex-col items-center gap-1 rounded-2xl border border-stone-200 bg-white px-2 py-3 text-sm font-semibold shadow-sm transition hover:border-rose-300 hover:bg-rose-50"
                    onClick={() => setWasteType(t.value)}
                  >
                    <span className="text-2xl">{t.emoji}</span>
                    {t.label}
                  </button>
                ))}
              </div>
            </>
          ) : null}

          {step === 2 ? (
            <>
              <p className={uiLabel}>Raison</p>
              <div className="flex flex-wrap gap-2">
                {WASTE_REASONS.map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-semibold shadow-sm transition hover:border-rose-300 hover:bg-rose-50"
                    onClick={() => setReason(r.value)}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </>
          ) : null}

          {step === 3 ? (
            <>
              {wasteType === "plate" ? (
                <div>
                  <label className={uiLabel} htmlFor="waste-dish">
                    Plat
                  </label>
                  <select
                    id="waste-dish"
                    className={uiInput + " mt-1 w-full"}
                    value={dishId}
                    onChange={(e) => setDishId(e.target.value)}
                  >
                    <option value="">Choisir…</option>
                    {dishes.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className={uiLabel} htmlFor="waste-item">
                    Composant
                  </label>
                  <select
                    id="waste-item"
                    className={uiInput + " mt-1 w-full"}
                    value={inventoryItemId}
                    onChange={(e) => setInventoryItemId(e.target.value)}
                  >
                    <option value="">Choisir…</option>
                    {inventoryItems.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name} ({i.unit})
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className={uiLabel} htmlFor="waste-qty">
                  Quantité {wasteType !== "plate" && selectedItem ? `(${unit})` : ""}
                </label>
                <input
                  id="waste-qty"
                  className={uiInput + " mt-1 w-full"}
                  inputMode="decimal"
                  placeholder="Ex. 0.5"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </div>
            </>
          ) : null}

          {error ? <p className={uiError}>{error}</p> : null}
        </div>

        <div className="flex gap-2 border-t border-stone-100 px-4 py-3">
          <button type="button" className={uiBtnSecondary} onClick={close} disabled={pending}>
            Annuler
          </button>
          {step === 3 ? (
            <button type="button" className={uiBtnPrimary + " flex-1"} onClick={submit} disabled={pending}>
              {pending ? "Enregistrement…" : "Enregistrer"}
            </button>
          ) : (
            <button
              type="button"
              className={uiBtnSecondary + " flex-1"}
              onClick={() => {
                if (step === 2 && reason) return;
                if (step === 1 && wasteType) return;
              }}
              disabled
            >
              Suivant
            </button>
          )}
        </div>
      </div>
    </ModalOverlay>
  );
}
