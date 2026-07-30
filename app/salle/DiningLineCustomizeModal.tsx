"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  getDiningLineCustomizationOptions,
  setDiningOrderLineModifications,
  type DiningLineCustomizationOptions,
} from "@/app/salle/actions";
import type { DiningLineClient } from "@/app/salle/commande/diningOrderTypes";
import type { LineModificationInput } from "@/lib/dining/lineModificationLogic";
import { uiBtnPrimary, uiError, uiLabel, uiLead } from "@/components/ui/premium";
import { ModalOverlay } from "@/components/ui/ModalOverlay";
import type { OrderTicketSnapshot } from "@/lib/dining/orderTicketSnapshot";

type Props = {
  restaurantId: string;
  line: DiningLineClient | null;
  onClose: () => void;
  onApplied: (ticket?: OrderTicketSnapshot) => void;
};

export function DiningLineCustomizeModal({ restaurantId, line, onClose, onApplied }: Props) {
  const [options, setOptions] = useState<DiningLineCustomizationOptions | null>(null);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [removedToppingIds, setRemovedToppingIds] = useState<Set<string>>(new Set());
  const [swapByComponentId, setSwapByComponentId] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!line) {
      setOptions(null);
      setRemovedToppingIds(new Set());
      setSwapByComponentId({});
      setError(null);
      return;
    }

    setLoadingOptions(true);
    setError(null);
    void getDiningLineCustomizationOptions({ restaurantId, lineId: line.id }).then((res) => {
      setLoadingOptions(false);
      if (!res.ok) {
        setError(res.error);
        setOptions(null);
        return;
      }
      setOptions(res.data ?? null);

      const removed = new Set<string>();
      const swaps: Record<string, string> = {};
      for (const mod of line.modifications) {
        if (mod.modificationType === "remove_component" && mod.dishComponentId) {
          removed.add(mod.dishComponentId);
        }
        if (
          mod.modificationType === "swap_accompaniment" &&
          mod.dishComponentId &&
          mod.replacementInventoryItemId
        ) {
          swaps[mod.dishComponentId] = mod.replacementInventoryItemId;
        }
      }
      setRemovedToppingIds(removed);
      setSwapByComponentId(swaps);
    });
  }, [line, restaurantId]);

  const swapTargetsBySource = useMemo(() => {
    const map = new Map<string, { inventoryItemId: string; name: string }[]>();
    if (!options) return map;
    const accs = options.accompaniments;
    for (const acc of accs) {
      const others = accs
        .filter((a) => a.dishComponentId !== acc.dishComponentId)
        .map((a) => ({ inventoryItemId: a.inventoryItemId, name: a.name }));
      map.set(acc.dishComponentId, others);
    }
    return map;
  }, [options]);

  if (!line) return null;

  const hasOptions =
    (options?.toppings.length ?? 0) > 0 || (options?.accompaniments.length ?? 0) > 0;

  const apply = () => {
    if (!options) return;
    setError(null);

    const modifications: LineModificationInput[] = [];

    for (const topping of options.toppings) {
      if (removedToppingIds.has(topping.dishComponentId)) {
        modifications.push({
          modificationType: "remove_component",
          dishComponentId: topping.dishComponentId,
          inventoryItemId: topping.inventoryItemId,
        });
      }
    }

    for (const acc of options.accompaniments) {
      const replacementId = swapByComponentId[acc.dishComponentId];
      if (replacementId && replacementId !== acc.inventoryItemId) {
        modifications.push({
          modificationType: "swap_accompaniment",
          dishComponentId: acc.dishComponentId,
          inventoryItemId: acc.inventoryItemId,
          replacementInventoryItemId: replacementId,
        });
      }
    }

    startTransition(async () => {
      const res = await setDiningOrderLineModifications({
        restaurantId,
        lineId: line.id,
        modifications,
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
    <ModalOverlay onClose={onClose}>
      <div className="mx-auto w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <h2 className="text-lg font-bold text-stone-900">Personnaliser — {line.dishName}</h2>
        <p className={`mt-1 text-sm ${uiLead}`}>
          Retirez une garniture ou changez l&apos;accompagnement. Les modifs partiront avec le
          service lorsque vous validerez l&apos;envoi en cuisine.
        </p>

        {loadingOptions ? (
          <p className={`mt-4 text-sm ${uiLead}`}>Chargement…</p>
        ) : !hasOptions ? (
          <div className={`mt-4 space-y-2 text-sm ${uiLead}`}>
            <p>Ce plat n&apos;a pas de composants modifiables au service.</p>
            <p>
              Sur la fiche plat, marquez un ingrédient direct comme « Garniture retirable » ou «
              Accompagnement » (pas une préparation intégrée à la recette).
            </p>
            <Link href={`/dishes/${line.dishId}`} className="font-semibold text-copper-700 underline">
              Ouvrir la fiche plat
            </Link>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {options!.toppings.length > 0 ? (
              <div>
                <p className={`${uiLabel} mb-2`}>Sans garniture</p>
                <ul className="space-y-2">
                  {options!.toppings.map((t) => (
                    <li key={t.dishComponentId}>
                      <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-stone-200 bg-stone-50/80 px-3 py-2 text-sm">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-stone-300"
                          checked={removedToppingIds.has(t.dishComponentId)}
                          onChange={(e) => {
                            setRemovedToppingIds((prev) => {
                              const next = new Set(prev);
                              if (e.target.checked) next.add(t.dishComponentId);
                              else next.delete(t.dishComponentId);
                              return next;
                            });
                          }}
                        />
                        <span className="font-medium text-stone-900">Sans {t.name.toLowerCase()}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {options!.accompaniments.length > 0 ? (
              <div>
                <p className={`${uiLabel} mb-2`}>Accompagnement</p>
                <ul className="space-y-2">
                  {options!.accompaniments.map((acc) => {
                    const targets = swapTargetsBySource.get(acc.dishComponentId) ?? [];
                    const current =
                      swapByComponentId[acc.dishComponentId] ?? acc.inventoryItemId;
                    return (
                      <li key={acc.dishComponentId} className="rounded-lg border border-stone-200 bg-stone-50/80 px-3 py-2">
                        <p className="mb-1 text-xs font-semibold text-stone-600">{acc.name}</p>
                        {targets.length === 0 ? (
                          <p className="text-xs text-stone-500">
                            Ajoutez d&apos;autres accompagnements sur la fiche plat pour permettre un
                            changement.
                          </p>
                        ) : (
                          <select
                            className="w-full rounded-lg border border-stone-200 bg-white px-2 py-1.5 text-sm"
                            value={current}
                            onChange={(e) =>
                              setSwapByComponentId((prev) => ({
                                ...prev,
                                [acc.dishComponentId]: e.target.value,
                              }))
                            }
                          >
                            <option value={acc.inventoryItemId}>{acc.name} (défaut)</option>
                            {targets.map((t) => (
                              <option key={t.inventoryItemId} value={t.inventoryItemId}>
                                {t.name}
                              </option>
                            ))}
                          </select>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}
          </div>
        )}

        {error ? <p className={`mt-3 text-sm ${uiError}`}>{error}</p> : null}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            className="rounded-xl px-4 py-2 text-sm font-semibold text-stone-600 hover:bg-stone-100"
            onClick={onClose}
            disabled={pending}
          >
            Annuler
          </button>
          <button
            type="button"
            className={uiBtnPrimary}
            onClick={apply}
            disabled={pending || loadingOptions || !hasOptions}
          >
            {pending ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}
