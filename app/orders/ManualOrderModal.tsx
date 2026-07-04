"use client";

import { useMemo, useState } from "react";
import { Search, Trash2 } from "lucide-react";
import type { InventoryItem, Supplier } from "@/lib/db";
import { generateOrderMessage, type OrderLineForMessage } from "@/lib/orders/message";
import { createPurchaseOrderFromSuggestion } from "./actions";
import { OrderSendChannels, type CreateOrderResult } from "./OrderSendChannels";
import { Modal } from "@/components/ui/Modal";
import { uiBtnPrimary, uiInput, uiLabel, uiSelect } from "@/components/ui/premium";

type ManualLine = { inventoryItemId: string; quantityPurchase: number };

function normalizeSearch(s: string): string {
  return s.toLowerCase().trim();
}

function matchesItem(item: InventoryItem, searchNorm: string): boolean {
  const compact = searchNorm.replace(/\s+/g, "");
  const nameNorm = normalizeSearch(item.name);
  const skuNorm = normalizeSearch(item.supplier_sku ?? "");
  return (
    nameNorm.includes(searchNorm) ||
    searchNorm.includes(nameNorm) ||
    skuNorm.includes(searchNorm) ||
    skuNorm.replace(/\s+/g, "").includes(compact)
  );
}

function lineToMessageLine(item: InventoryItem, qty: number): OrderLineForMessage {
  return {
    name: item.name,
    quantity: qty,
    purchase_unit: item.purchase_unit?.trim() || "unité(s)",
    supplier_sku: item.supplier_sku?.trim() || null,
  };
}

function defaultQty(item: InventoryItem): number {
  const min = item.min_order_quantity != null ? Number(item.min_order_quantity) : 1;
  const multiple = item.order_multiple != null ? Number(item.order_multiple) : 1;
  const base = Number.isFinite(min) && min > 0 ? min : 1;
  if (Number.isFinite(multiple) && multiple > 0) return Math.ceil(base / multiple) * multiple;
  return base;
}

export function ManualOrderModal({
  restaurantId,
  restaurantName,
  suppliers,
  inventoryItems,
  initialSupplierId,
  onClose,
}: {
  restaurantId: string;
  restaurantName: string;
  suppliers: Supplier[];
  inventoryItems: InventoryItem[];
  /** Fournisseur présélectionné (ex. depuis sa fiche). */
  initialSupplierId?: string;
  onClose: () => void;
}) {
  const [supplierId, setSupplierId] = useState(initialSupplierId ?? suppliers[0]?.id ?? "");
  const [search, setSearch] = useState("");
  const [lines, setLines] = useState<ManualLine[]>([]);
  const [customMessage, setCustomMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const supplier = suppliers.find((s) => s.id === supplierId) ?? null;
  const itemById = useMemo(() => new Map(inventoryItems.map((i) => [i.id, i])), [inventoryItems]);
  const usedIds = useMemo(() => new Set(lines.map((l) => l.inventoryItemId)), [lines]);
  const validLines = lines.filter((l) => l.quantityPurchase > 0);

  const message = useMemo(() => {
    if (customMessage !== null) return customMessage;
    if (!supplier) return "";
    const msgLines = lines
      .map((l) => {
        const item = itemById.get(l.inventoryItemId);
        return item ? lineToMessageLine(item, l.quantityPurchase) : null;
      })
      .filter((l): l is OrderLineForMessage => Boolean(l));
    return generateOrderMessage(supplier, msgLines, restaurantName);
  }, [customMessage, itemById, lines, restaurantName, supplier]);

  const matches = useMemo(() => {
    const s = normalizeSearch(search);
    if (s.length < 1) return [];
    return inventoryItems
      .filter((item) => !usedIds.has(item.id) && matchesItem(item, s))
      .sort((a, b) => {
        const aSame = supplierId && a.supplier_id === supplierId ? 0 : 1;
        const bSame = supplierId && b.supplier_id === supplierId ? 0 : 1;
        return aSame - bSame || a.name.localeCompare(b.name, "fr");
      })
      .slice(0, 10);
  }, [inventoryItems, search, supplierId, usedIds]);

  function updateLineQty(id: string, raw: string) {
    const qty = Number(raw.replace(",", "."));
    setLines((prev) =>
      prev.map((l) => (l.inventoryItemId === id ? { ...l, quantityPurchase: Number.isFinite(qty) && qty > 0 ? qty : 0 } : l))
    );
    setCustomMessage(null);
  }

  function addItem(item: InventoryItem) {
    setLines((prev) => [...prev, { inventoryItemId: item.id, quantityPurchase: defaultQty(item) }]);
    setSearch("");
    setCustomMessage(null);
  }

  function removeLine(id: string) {
    setLines((prev) => prev.filter((l) => l.inventoryItemId !== id));
    setCustomMessage(null);
  }

  async function createOrder(): Promise<CreateOrderResult> {
    if (!supplier) return { ok: false, error: "Choisissez un fournisseur." };
    if (validLines.length === 0) return { ok: false, error: "Ajoutez au moins un produit avec une quantité." };
    return createPurchaseOrderFromSuggestion({
      restaurantId,
      supplierId: supplier.id,
      generatedMessage: message,
      lines: validLines.map((l) => ({
        inventory_item_id: l.inventoryItemId,
        ordered_qty_purchase_unit: l.quantityPurchase,
      })),
    });
  }

  return (
    <Modal
      title="Nouvelle commande"
      subtitle={supplier?.name}
      icon={Search}
      size="lg"
      onClose={() => {
        if (!busy) onClose();
      }}
      footer={
        <button type="button" disabled={busy} onClick={onClose} className={uiBtnPrimary}>
          Terminer
        </button>
      }
    >
      {suppliers.length === 0 ? (
        <p className="text-sm text-stone-600">
          Créez d’abord au moins un fournisseur actif pour pouvoir préparer une commande.
        </p>
      ) : (
        <div className="space-y-4">
          {/* Fournisseur */}
          <div>
            <label className={uiLabel} htmlFor="manual-supplier">
              Fournisseur
            </label>
            <select
              id="manual-supplier"
              value={supplierId}
              onChange={(e) => {
                setSupplierId(e.target.value);
                setCustomMessage(null);
              }}
              className={`${uiSelect} mt-1 w-full`}
            >
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Recherche produit */}
          <div>
            <label className={uiLabel}>Ajouter des produits</label>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un ingrédient, une préparation, une réf. fournisseur…"
              className={`${uiInput} mt-1 w-full`}
              autoComplete="off"
            />
            {matches.length > 0 ? (
              <ul className="mt-2 max-h-52 overflow-auto rounded-xl border border-stone-100 bg-white shadow-sm">
                {matches.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => addItem(item)}
                      className="flex w-full flex-wrap items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-copper-50/60"
                    >
                      <span>
                        <span className="font-medium text-stone-900">{item.name}</span>
                        <span className="ml-1 text-stone-500">({item.unit})</span>
                      </span>
                      <span className="text-xs text-stone-500">
                        {item.supplier_id === supplierId ? "fournisseur choisi" : "autre / non lié"}
                        {item.supplier_sku ? ` · réf. ${item.supplier_sku}` : ""}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : search.trim() ? (
              <p className="mt-2 text-xs text-stone-500">Aucun produit trouvé.</p>
            ) : null}
          </div>

          {/* Lignes */}
          <div>
            <p className={uiLabel}>Lignes de commande</p>
            {lines.length === 0 ? (
              <p className="mt-1 text-sm text-stone-400">Aucun produit ajouté.</p>
            ) : (
              <ul className="mt-1 divide-y divide-stone-100 overflow-hidden rounded-xl border border-stone-200/70">
                {lines.map((line) => {
                  const item = itemById.get(line.inventoryItemId);
                  if (!item) return null;
                  return (
                    <li key={line.inventoryItemId} className="flex items-center gap-2 px-3 py-2">
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-stone-800">
                        {item.name}
                        {item.supplier_sku ? <span className="ml-1 text-xs text-stone-400">réf. {item.supplier_sku}</span> : null}
                      </span>
                      <input
                        type="text"
                        inputMode="decimal"
                        aria-label={`Quantité ${item.name}`}
                        value={line.quantityPurchase || ""}
                        onChange={(e) => updateLineQty(line.inventoryItemId, e.target.value)}
                        className={`${uiInput} h-9 w-20 text-right tabular-nums`}
                      />
                      <span className="w-16 shrink-0 text-xs text-stone-500">{item.purchase_unit ?? "unité(s)"}</span>
                      <button
                        type="button"
                        onClick={() => removeLine(line.inventoryItemId)}
                        aria-label="Retirer"
                        className="rounded-lg p-1.5 text-stone-400 transition hover:bg-rose-50 hover:text-rose-600"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Message */}
          <div>
            <label className={uiLabel} htmlFor="manual-message">
              Message fournisseur (modifiable)
            </label>
            <textarea
              id="manual-message"
              value={message}
              onChange={(e) => setCustomMessage(e.target.value)}
              rows={6}
              className={`${uiInput} mt-1 w-full font-mono text-xs leading-relaxed`}
            />
          </div>

          {/* Canaux d'envoi (création à la volée) */}
          <div className="border-t border-stone-100 pt-3">
            <OrderSendChannels
              restaurantId={restaurantId}
              supplierEmail={supplier?.email ?? null}
              supplierPhone={supplier?.phone ?? null}
              supplierWhatsapp={supplier?.whatsapp_phone ?? null}
              message={message}
              createOrder={createOrder}
              disabled={validLines.length === 0}
              onBusyChange={setBusy}
            />
          </div>
        </div>
      )}
    </Modal>
  );
}
