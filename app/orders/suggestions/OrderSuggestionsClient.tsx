"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { SupplierSuggestion } from "@/lib/orders/suggestions";
import { generateOrderMessage, suggestedLinesToMessageLines } from "@/lib/orders/message";
import { isOrderDayToday } from "@/lib/orders/suggestions";
import { createPurchaseOrderFromSuggestion } from "../actions";

type Props = {
  suggestions: SupplierSuggestion[];
  restaurantId: string;
  restaurantName: string;
};

function getMessageForSupplier(s: SupplierSuggestion, restaurantName: string): string {
  return generateOrderMessage(
    s.supplier,
    suggestedLinesToMessageLines(s.lines),
    restaurantName
  );
}

export function OrderSuggestionsClient({ suggestions: initialSuggestions, restaurantId, restaurantName }: Props) {
  const router = useRouter();
  const [suggestions, setSuggestions] = useState(initialSuggestions);
  const [generatePending, setGeneratePending] = useState<string | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [generateFailedSupplierId, setGenerateFailedSupplierId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const s of initialSuggestions) {
      out[s.supplier.id] = getMessageForSupplier(s, restaurantName);
    }
    return out;
  });

  const setLineQuantity = useCallback(
    (supplierId: string, inventoryItemId: string, quantity: number) => {
      setSuggestions((prev) => {
        const next = prev.map((s) => {
          if (s.supplier.id !== supplierId) return s;
          const newLines = s.lines.map((l) =>
            l.inventory_item_id === inventoryItemId
              ? { ...l, suggested_quantity_purchase: Math.max(0, quantity) }
              : l
          );
          return { ...s, lines: newLines };
        });
        const updated = next.find((s) => s.supplier.id === supplierId);
        if (updated) {
          setMessages((m) => ({
            ...m,
            [supplierId]: getMessageForSupplier(updated, restaurantName),
          }));
        }
        return next;
      });
    },
    [restaurantName]
  );

  const setMessageForSupplier = useCallback((supplierId: string, text: string) => {
    setMessages((m) => ({ ...m, [supplierId]: text }));
  }, []);

  async function handleGenerateOrder(supplierId: string) {
    const s = suggestions.find((x) => x.supplier.id === supplierId);
    if (!s || s.lines.length === 0) return;
    setGenerateError(null);
    setGenerateFailedSupplierId(null);
    setGeneratePending(supplierId);
    const result = await createPurchaseOrderFromSuggestion({
      restaurantId,
      supplierId,
      generatedMessage: messages[supplierId] ?? null,
      lines: s.lines.map((l) => ({
        inventory_item_id: l.inventory_item_id,
        ordered_qty_purchase_unit: l.suggested_quantity_purchase,
      })),
    });
    setGeneratePending(null);
    if (result.ok && result.data?.orderId) {
      router.push(`/orders/${result.data.orderId}`);
    } else {
      setGenerateError(result.ok === false ? result.error : "Erreur lors de la génération.");
      setGenerateFailedSupplierId(supplierId);
    }
  }

  if (suggestions.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <p className="mb-2 text-slate-600">
          Aucune commande suggérée pour le moment.
        </p>
        <p className="text-sm text-slate-500">
          Pour qu’un composant apparaisse ici : choisir un fournisseur, renseigner l’unité d’achat et surtout <strong>la conversion</strong> (1 unité achetée = combien d’unités de stock). Sans conversion, aucune suggestion n’est proposée pour éviter des quantités incorrectes.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {suggestions.map(({ supplier, lines }) => {
        const orderDayToday = isOrderDayToday(supplier);
        const message = messages[supplier.id] ?? "";

        return (
          <section
            key={supplier.id}
            className="rounded-lg border border-slate-200 bg-white p-4"
          >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-slate-900">
                {supplier.name}
              </h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={!!generatePending}
                  onClick={() => handleGenerateOrder(supplier.id)}
                  className="rounded bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-50"
                >
                  {generatePending === supplier.id ? "Génération…" : "Générer la commande"}
                </button>
              </div>
              {orderDayToday ? (
                <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                  Jour de commande
                </span>
              ) : (
                <span className="text-xs text-slate-500">
                  Pas un jour de commande
                </span>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-500">
                    <th className="pb-2 pr-2">Composant</th>
                    <th className="pb-2 pr-2 text-right">Stock actuel</th>
                    <th className="pb-2 pr-2 text-right">Besoin</th>
                    <th className="pb-2 pr-2 text-right">Seuil min</th>
                    <th className="pb-2 pr-2 text-right">Commande suggérée</th>
                    <th className="pb-2">Unité achat</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line) => (
                    <tr key={line.inventory_item_id} className="border-b border-slate-100">
                      <td className="py-2 pr-2 font-medium text-slate-800">
                        {line.name}
                      </td>
                      <td className="py-2 pr-2 text-right text-slate-600">
                        {line.current_stock_qty} {line.unit}
                      </td>
                      <td className="py-2 pr-2 text-right text-slate-600">
                        {line.need_stock_qty} {line.unit}
                      </td>
                      <td className="py-2 pr-2 text-right text-slate-600">
                        {line.min_stock_qty ?? "—"}
                      </td>
                      <td className="py-2 pr-2 text-right">
                        <input
                          type="number"
                          min={0}
                          step={1}
                          value={line.suggested_quantity_purchase}
                          onChange={(e) =>
                            setLineQuantity(
                              supplier.id,
                              line.inventory_item_id,
                              parseInt(e.target.value, 10) || 0
                            )
                          }
                          className="w-16 rounded border border-slate-300 px-2 py-1 text-right text-sm"
                        />
                      </td>
                      <td className="py-2 text-slate-600">
                        {line.purchase_unit ?? "unité(s)"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4">
              <label className="mb-1 block text-xs font-medium text-slate-500">
                Message prêt à envoyer (modifiable)
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessageForSupplier(supplier.id, e.target.value)}
                rows={8}
                className="w-full rounded border border-slate-300 bg-white p-3 font-mono text-sm text-slate-800"
              />
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(message)}
                  className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
                >
                  Copier le message
                </button>
              </div>
              {generateError && generateFailedSupplierId === supplier.id ? (
                <p className="mt-2 text-sm text-red-600">{generateError}</p>
              ) : null}
            </div>
          </section>
        );
      })}
    </div>
  );
}
