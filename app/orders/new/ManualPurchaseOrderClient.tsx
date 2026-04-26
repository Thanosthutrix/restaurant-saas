"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { InventoryItem, Supplier } from "@/lib/db";
import { generateOrderMessage, type OrderLineForMessage } from "@/lib/orders/message";
import { uiBtnOutlineSm, uiBtnPrimary, uiError, uiInput, uiLead, uiSelect } from "@/components/ui/premium";
import { createPurchaseOrderFromSuggestion } from "../actions";

type ManualLine = {
  inventoryItemId: string;
  quantityPurchase: number;
};

type Props = {
  restaurantId: string;
  restaurantName: string;
  suppliers: Supplier[];
  inventoryItems: InventoryItem[];
};

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
  if (Number.isFinite(multiple) && multiple > 0) {
    return Math.ceil(base / multiple) * multiple;
  }
  return base;
}

export function ManualPurchaseOrderClient({ restaurantId, restaurantName, suppliers, inventoryItems }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id ?? "");
  const [search, setSearch] = useState("");
  const [lines, setLines] = useState<ManualLine[]>([]);
  const [customMessage, setCustomMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const supplier = suppliers.find((s) => s.id === supplierId) ?? null;
  const itemById = useMemo(() => new Map(inventoryItems.map((i) => [i.id, i])), [inventoryItems]);
  const usedIds = useMemo(() => new Set(lines.map((l) => l.inventoryItemId)), [lines]);

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
        const aSameSupplier = supplierId && a.supplier_id === supplierId ? 0 : 1;
        const bSameSupplier = supplierId && b.supplier_id === supplierId ? 0 : 1;
        return aSameSupplier - bSameSupplier || a.name.localeCompare(b.name, "fr");
      })
      .slice(0, 12);
  }, [inventoryItems, search, supplierId, usedIds]);

  const updateLineQty = (inventoryItemId: string, raw: string) => {
    const qty = Number(raw.replace(",", "."));
    setLines((prev) =>
      prev.map((l) =>
        l.inventoryItemId === inventoryItemId
          ? { ...l, quantityPurchase: Number.isFinite(qty) && qty > 0 ? qty : 0 }
          : l
      )
    );
    setCustomMessage(null);
  };

  const addItem = (item: InventoryItem) => {
    setLines((prev) => [...prev, { inventoryItemId: item.id, quantityPurchase: defaultQty(item) }]);
    setSearch("");
    setCustomMessage(null);
  };

  const removeLine = (inventoryItemId: string) => {
    setLines((prev) => prev.filter((l) => l.inventoryItemId !== inventoryItemId));
    setCustomMessage(null);
  };

  const createOrder = () => {
    setError(null);
    if (!supplier) {
      setError("Choisissez un fournisseur.");
      return;
    }
    const validLines = lines.filter((l) => l.quantityPurchase > 0);
    if (validLines.length === 0) {
      setError("Ajoutez au moins un produit avec une quantité.");
      return;
    }
    startTransition(async () => {
      const res = await createPurchaseOrderFromSuggestion({
        restaurantId,
        supplierId: supplier.id,
        generatedMessage: message,
        lines: validLines.map((l) => ({
          inventory_item_id: l.inventoryItemId,
          ordered_qty_purchase_unit: l.quantityPurchase,
        })),
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      if (res.data?.orderId) router.push(`/orders/${res.data.orderId}`);
    });
  };

  if (suppliers.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <p className={uiLead}>Créez d’abord au moins un fournisseur actif pour pouvoir préparer une commande.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)]">
      <div className="space-y-4">
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-500">Fournisseur</span>
            <select
              value={supplierId}
              onChange={(e) => {
                setSupplierId(e.target.value);
                setCustomMessage(null);
              }}
              className={`w-full ${uiSelect}`}
            >
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          {supplier ? (
            <p className="mt-2 text-xs text-slate-500">
              Canal préféré : {supplier.preferred_order_method}
              {supplier.email ? ` · ${supplier.email}` : ""}
            </p>
          ) : null}
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-semibold text-slate-900">Ajouter des produits</h2>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un ingrédient, une préparation, une réf. fournisseur…"
            className={`w-full ${uiInput}`}
            autoComplete="off"
          />
          {matches.length > 0 ? (
            <ul className="mt-2 max-h-72 overflow-auto rounded-xl border border-slate-100 bg-white shadow-sm">
              {matches.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => addItem(item)}
                    className="flex w-full flex-wrap items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-indigo-50/60"
                  >
                    <span>
                      <span className="font-medium text-slate-900">{item.name}</span>
                      <span className="ml-1 text-slate-500">({item.unit})</span>
                    </span>
                    <span className="text-xs text-slate-500">
                      {item.supplier_id === supplierId ? "fournisseur choisi" : "autre fournisseur / non lié"}
                      {item.supplier_sku ? ` · réf. ${item.supplier_sku}` : ""}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : search.trim() ? (
            <p className="mt-2 text-xs text-slate-500">Aucun produit trouvé.</p>
          ) : null}
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Lignes de commande</h2>
          {lines.length === 0 ? (
            <p className={uiLead}>Aucun produit ajouté.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-500">
                    <th className="pb-2 pr-2">Produit</th>
                    <th className="pb-2 pr-2 text-right">Quantité achat</th>
                    <th className="pb-2 pr-2">Unité achat</th>
                    <th className="pb-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line) => {
                    const item = itemById.get(line.inventoryItemId);
                    if (!item) return null;
                    return (
                      <tr key={line.inventoryItemId} className="border-b border-slate-100">
                        <td className="py-2 pr-2 font-medium text-slate-800">
                          {item.name}
                          {item.supplier_sku ? <span className="ml-1 text-slate-500">(réf. {item.supplier_sku})</span> : null}
                        </td>
                        <td className="py-2 pr-2 text-right">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={line.quantityPurchase || ""}
                            onChange={(e) => updateLineQty(line.inventoryItemId, e.target.value)}
                            className={`w-24 text-right ${uiInput}`}
                          />
                        </td>
                        <td className="py-2 pr-2 text-slate-600">{item.purchase_unit ?? "unité(s)"}</td>
                        <td className="py-2 text-right">
                          <button type="button" onClick={() => removeLine(line.inventoryItemId)} className={uiBtnOutlineSm}>
                            Retirer
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <aside className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 lg:sticky lg:top-4 lg:self-start">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Message fournisseur</h2>
          <p className="mt-1 text-xs text-slate-500">Prérempli comme pour les suggestions, modifiable avant création.</p>
        </div>
        <textarea
          value={message}
          onChange={(e) => setCustomMessage(e.target.value)}
          rows={14}
          className="w-full rounded border border-slate-300 bg-white p-3 font-mono text-sm text-slate-800"
        />
        {error ? <p className={uiError}>{error}</p> : null}
        <button type="button" disabled={pending || lines.length === 0} onClick={createOrder} className={`w-full ${uiBtnPrimary}`}>
          {pending ? "Création…" : "Créer la commande"}
        </button>
      </aside>
    </div>
  );
}
