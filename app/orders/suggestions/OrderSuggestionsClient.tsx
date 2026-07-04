"use client";

import { useState, useCallback } from "react";
import { CalendarCheck, Check, ClipboardCheck, Copy, PackageSearch, Plus, Send, Truck } from "lucide-react";
import type { InventoryItem, Supplier } from "@/lib/db";
import type { SupplierSuggestion } from "@/lib/orders/suggestions";
import { generateOrderMessage, suggestedLinesToMessageLines } from "@/lib/orders/message";
import { isOrderDayToday } from "@/lib/orders/suggestions";
import { createPurchaseOrderFromSuggestion } from "../actions";
import { OrderSendChannels } from "../OrderSendChannels";
import { ManualOrderModal } from "../ManualOrderModal";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { uiBtnPrimary, uiBtnSecondary, uiInput, uiLabel } from "@/components/ui/premium";

type Props = {
  suggestions: SupplierSuggestion[];
  restaurantId: string;
  restaurantName: string;
  suppliers: Supplier[];
  inventoryItems: InventoryItem[];
};

function getMessageForSupplier(s: SupplierSuggestion, restaurantName: string): string {
  return generateOrderMessage(s.supplier, suggestedLinesToMessageLines(s.lines), restaurantName);
}

export function OrderSuggestionsClient({
  suggestions: initialSuggestions,
  restaurantId,
  restaurantName,
  suppliers,
  inventoryItems,
}: Props) {
  const [suggestions, setSuggestions] = useState(initialSuggestions);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [confirmSupplierId, setConfirmSupplierId] = useState<string | null>(null);
  const [modalBusy, setModalBusy] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [messages, setMessages] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const s of initialSuggestions) out[s.supplier.id] = getMessageForSupplier(s, restaurantName);
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
        if (updated) setMessages((m) => ({ ...m, [supplierId]: getMessageForSupplier(updated, restaurantName) }));
        return next;
      });
    },
    [restaurantName]
  );

  const setMessageForSupplier = useCallback((supplierId: string, text: string) => {
    setMessages((m) => ({ ...m, [supplierId]: text }));
  }, []);

  function copyMessage(supplierId: string) {
    navigator.clipboard.writeText(messages[supplierId] ?? "").then(() => {
      setCopiedId(supplierId);
      window.setTimeout(() => setCopiedId((c) => (c === supplierId ? null : c)), 2000);
    });
  }

  function closeConfirm() {
    if (modalBusy) return;
    setConfirmSupplierId(null);
  }

  const supplierCount = suggestions.length;
  const lineCount = suggestions.reduce((n, s) => n + s.lines.length, 0);
  const orderDayCount = suggestions.filter((s) => isOrderDayToday(s.supplier)).length;

  const stats: { label: string; value: number; icon: typeof Truck; tone: string }[] = [
    { label: "Fournisseurs à commander", value: supplierCount, icon: Truck, tone: "bg-sky-50 text-sky-700" },
    { label: "Composants à réappro.", value: lineCount, icon: PackageSearch, tone: "bg-amber-50 text-amber-700" },
    { label: "Jours de commande aujourd’hui", value: orderDayCount, icon: CalendarCheck, tone: "bg-emerald-50 text-emerald-700" },
  ];

  const confirmSuggestion = confirmSupplierId
    ? suggestions.find((s) => s.supplier.id === confirmSupplierId) ?? null
    : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={() => setManualOpen(true)}
          className={`${uiBtnSecondary} inline-flex items-center gap-1.5`}
        >
          <Plus className="h-4 w-4" aria-hidden />
          Créer une commande manuelle
        </button>
      </div>

      {suggestions.length === 0 ? (
        <EmptyState
          icon={PackageSearch}
          title="Aucune commande suggérée"
          description="Pour qu’un composant apparaisse ici : choisir un fournisseur, renseigner l’unité d’achat et surtout la conversion (1 unité achetée = combien d’unités de stock). Vous pouvez aussi créer une commande manuelle ci-dessus."
        />
      ) : (
        <>
          {/* Synthèse */}
          <section className="grid grid-cols-3 gap-3" aria-label="Synthèse">
            {stats.map((s) => {
              const Icon = s.icon;
              return (
                <div
                  key={s.label}
                  className="flex items-center gap-3 rounded-2xl border border-stone-200/70 bg-white p-3 shadow-sm sm:p-4"
                >
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${s.tone}`}>
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p className="text-2xl font-semibold tabular-nums leading-none tracking-tight text-stone-900">
                      {s.value}
                    </p>
                    <p className="mt-1 text-xs font-medium text-stone-500">{s.label}</p>
                  </div>
                </div>
              );
            })}
          </section>

          {/* Une carte par fournisseur */}
          {suggestions.map(({ supplier, lines }) => {
            const orderDayToday = isOrderDayToday(supplier);
            const message = messages[supplier.id] ?? "";

            return (
              <section
                key={supplier.id}
                className="overflow-hidden rounded-2xl border border-stone-200/70 bg-white shadow-sm"
              >
                <div className="flex flex-wrap items-center gap-3 border-b border-stone-100 px-4 py-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-700">
                    <Truck className="h-5 w-5" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-base font-semibold text-stone-900">{supplier.name}</h2>
                    <p className="text-xs text-stone-500">
                      {lines.length} composant{lines.length > 1 ? "s" : ""} à réapprovisionner
                    </p>
                  </div>
                  {orderDayToday ? (
                    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                      <CalendarCheck className="h-3.5 w-3.5" aria-hidden />
                      Jour de commande
                    </span>
                  ) : (
                    <span className="rounded-md bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-500">
                      Hors jour de commande
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setModalBusy(false);
                      setConfirmSupplierId(supplier.id);
                    }}
                    className={`${uiBtnPrimary} inline-flex items-center gap-1.5`}
                  >
                    <ClipboardCheck className="h-4 w-4" aria-hidden />
                    Générer la commande
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[680px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-stone-100 bg-stone-50/60 text-[11px] font-semibold uppercase tracking-wide text-stone-500">
                        <th className="px-4 py-2.5">Composant</th>
                        <th className="px-4 py-2.5 text-right">Stock actuel</th>
                        <th className="px-4 py-2.5 text-right">Besoin</th>
                        <th className="px-4 py-2.5 text-right">Seuil min</th>
                        <th className="px-4 py-2.5 text-right">Commande</th>
                        <th className="px-4 py-2.5">Unité achat</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((line) => (
                        <tr
                          key={line.inventory_item_id}
                          className="border-b border-stone-50 transition hover:bg-stone-50/70"
                        >
                          <td className="px-4 py-2.5 font-medium text-stone-800">{line.name}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-stone-600">
                            {line.current_stock_qty} {line.unit}
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-stone-600">
                            {line.need_stock_qty} {line.unit}
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-stone-500">
                            {line.min_stock_qty ?? "—"}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <input
                              type="number"
                              min={0}
                              step={1}
                              value={line.suggested_quantity_purchase}
                              onChange={(e) =>
                                setLineQuantity(supplier.id, line.inventory_item_id, parseInt(e.target.value, 10) || 0)
                              }
                              className={`${uiInput} h-9 w-20 text-right tabular-nums`}
                            />
                          </td>
                          <td className="px-4 py-2.5 text-stone-600">{line.purchase_unit ?? "unité(s)"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="border-t border-stone-100 px-4 py-3">
                  <label className={uiLabel} htmlFor={`msg-${supplier.id}`}>
                    Message prêt à envoyer (modifiable)
                  </label>
                  <textarea
                    id={`msg-${supplier.id}`}
                    value={message}
                    onChange={(e) => setMessageForSupplier(supplier.id, e.target.value)}
                    rows={7}
                    className={`${uiInput} mt-1 w-full font-mono text-xs leading-relaxed`}
                  />
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => copyMessage(supplier.id)}
                      className={`${uiBtnSecondary} inline-flex items-center gap-1.5`}
                    >
                      {copiedId === supplier.id ? (
                        <>
                          <Check className="h-4 w-4 text-emerald-600" aria-hidden />
                          Copié
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4" aria-hidden />
                          Copier le message
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </section>
            );
          })}
        </>
      )}

      {/* Modale : générer + envoyer (suggestions) */}
      {confirmSuggestion ? (
        <Modal
          title="Commander & envoyer"
          subtitle={confirmSuggestion.supplier.name}
          icon={Send}
          onClose={closeConfirm}
          footer={
            <button type="button" disabled={modalBusy} onClick={closeConfirm} className={uiBtnPrimary}>
              Terminer
            </button>
          }
        >
          <p className="text-sm text-stone-600">
            <span className="font-semibold text-stone-800">{confirmSuggestion.lines.length}</span> composant
            {confirmSuggestion.lines.length > 1 ? "s" : ""} pour{" "}
            <span className="font-semibold text-stone-800">{confirmSuggestion.supplier.name}</span> — choisissez le canal
            d’envoi, la commande est créée automatiquement.
          </p>
          <ul className="mt-3 max-h-40 divide-y divide-stone-100 overflow-y-auto rounded-xl border border-stone-200/70">
            {confirmSuggestion.lines.map((l) => (
              <li key={l.inventory_item_id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <span className="min-w-0 truncate font-medium text-stone-800">{l.name}</span>
                <span className="shrink-0 tabular-nums font-semibold text-stone-700">
                  {l.suggested_quantity_purchase} {l.purchase_unit ?? "unité(s)"}
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-4 border-t border-stone-100 pt-3">
            <OrderSendChannels
              restaurantId={restaurantId}
              supplierEmail={confirmSuggestion.supplier.email}
              supplierPhone={confirmSuggestion.supplier.phone}
              supplierWhatsapp={confirmSuggestion.supplier.whatsapp_phone}
              message={messages[confirmSuggestion.supplier.id] ?? ""}
              createOrder={() =>
                createPurchaseOrderFromSuggestion({
                  restaurantId,
                  supplierId: confirmSuggestion.supplier.id,
                  generatedMessage: messages[confirmSuggestion.supplier.id] ?? null,
                  lines: confirmSuggestion.lines.map((l) => ({
                    inventory_item_id: l.inventory_item_id,
                    ordered_qty_purchase_unit: l.suggested_quantity_purchase,
                  })),
                })
              }
              onBusyChange={setModalBusy}
            />
          </div>
        </Modal>
      ) : null}

      {/* Modale : commande manuelle */}
      {manualOpen ? (
        <ManualOrderModal
          restaurantId={restaurantId}
          restaurantName={restaurantName}
          suppliers={suppliers}
          inventoryItems={inventoryItems}
          onClose={() => setManualOpen(false)}
        />
      ) : null}
    </div>
  );
}
