"use client";

import { useState, useMemo } from "react";
import { ALLOWED_UNITS, STOCK_UNIT_LABEL_FR, type AllowedUnit } from "@/lib/constants";
import type { InventoryItem } from "@/lib/db";
import { uiBtnOutlineSm, uiBtnPrimarySm, uiInput, uiLabel, uiSelect } from "@/components/ui/premium";

const ITEM_TYPE_OPTIONS: { value: "ingredient" | "prep" | "resale"; label: string }[] = [
  { value: "ingredient", label: "Matière première" },
  { value: "prep", label: "Préparation" },
  { value: "resale", label: "Revente" },
];

function normalizeSearch(s: string): string {
  return s.toLowerCase().trim();
}

function matchesSearch(item: InventoryItem, searchNorm: string): boolean {
  const nameNorm = normalizeSearch(item.name);
  return nameNorm.includes(searchNorm) || searchNorm.includes(nameNorm);
}

export function InventoryItemSearchOrCreate({
  allItems,
  excludedIds,
  onAddExisting,
  onAddNew,
  disabled = false,
}: {
  allItems: InventoryItem[];
  excludedIds: Set<string>;
  onAddExisting: (inventoryItemId: string, qty: number) => Promise<void>;
  onAddNew: (params: { name: string; unit: string; itemType: "ingredient" | "prep" | "resale"; currentStockQty?: number; minStockQty?: number | null }, qty: number) => Promise<void>;
  disabled?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [qtyForExisting, setQtyForExisting] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createUnit, setCreateUnit] = useState<AllowedUnit>("unit");
  const [createType, setCreateType] = useState<"ingredient" | "prep" | "resale">("ingredient");
  const [createStockQty, setCreateStockQty] = useState("");
  const [createQty, setCreateQty] = useState("");
  const [loading, setLoading] = useState(false);

  const available = useMemo(
    () => allItems.filter((i) => !excludedIds.has(i.id)),
    [allItems, excludedIds]
  );

  const searchNorm = normalizeSearch(search);
  const matches = useMemo(
    () =>
      searchNorm.length >= 1
        ? available.filter((i) => matchesSearch(i, searchNorm)).slice(0, 10)
        : [],
    [available, searchNorm]
  );

  const hasMatches = matches.length > 0;
  const showCreateOption = searchNorm.length >= 1 && !hasMatches;

  async function handleAddExisting() {
    if (!selectedItem) return;
    const num = parseFloat(qtyForExisting.replace(",", "."));
    if (!Number.isFinite(num) || num <= 0) return;
    setLoading(true);
    await onAddExisting(selectedItem.id, num);
    setLoading(false);
    setSelectedItem(null);
    setQtyForExisting("");
    setSearch("");
  }

  async function handleCreateAndAdd(e: React.FormEvent) {
    e.preventDefault();
    const name = createName.trim();
    const num = parseFloat(createQty.replace(",", "."));
    const stockNum = createStockQty.trim() === "" ? 0 : parseFloat(createStockQty.replace(",", "."));
    if (!name) return;
    if (!Number.isFinite(num) || num <= 0) return;
    if (!Number.isFinite(stockNum) || stockNum < 0) return;
    setLoading(true);
    await onAddNew({ name, unit: createUnit, itemType: createType, currentStockQty: stockNum }, num);
    setLoading(false);
    setShowCreateForm(false);
    setCreateName("");
    setCreateUnit("unit");
    setCreateType("ingredient");
    setCreateStockQty("");
    setCreateQty("");
    setSearch("");
  }

  function openCreateForm() {
    setCreateName(search.trim());
    setCreateUnit("unit");
    setCreateType("ingredient");
    setCreateStockQty("");
    setCreateQty("");
    setShowCreateForm(true);
  }

  if (selectedItem) {
    return (
      <div className="flex flex-wrap items-end gap-2 rounded-xl border border-slate-100 bg-slate-50/80 p-3 shadow-sm">
        <span className="text-sm text-slate-600">
          Sélectionné : <strong className="text-slate-900">{selectedItem.name}</strong> ({selectedItem.unit})
        </span>
        <input
          type="text"
          inputMode="decimal"
          value={qtyForExisting}
          onChange={(e) => setQtyForExisting(e.target.value)}
          placeholder="Quantité"
          className={`w-24 ${uiInput}`}
          autoFocus
        />
        <button
          type="button"
          onClick={handleAddExisting}
          disabled={loading || !qtyForExisting.trim()}
          className={uiBtnPrimarySm}
        >
          {loading ? "…" : "Ajouter"}
        </button>
        <button
          type="button"
          onClick={() => {
            setSelectedItem(null);
            setQtyForExisting("");
          }}
          className={uiBtnOutlineSm}
        >
          Changer
        </button>
      </div>
    );
  }

  if (showCreateForm) {
    return (
      <form
        onSubmit={handleCreateAndAdd}
        className="space-y-2 rounded-2xl border border-violet-200/80 bg-violet-50/50 p-4 shadow-sm"
      >
        <p className="text-sm font-medium text-violet-900">Créer et ajouter</p>
        <div className="flex flex-wrap gap-2">
          <label className="flex flex-col gap-0.5">
            <span className={uiLabel}>Nom</span>
            <input
              type="text"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              className={uiInput}
              required
            />
          </label>
          <label className="flex flex-col gap-0.5">
            <span className={uiLabel}>Unité</span>
            <select
              value={createUnit}
              onChange={(e) => setCreateUnit(e.target.value as AllowedUnit)}
              className={`min-w-[7rem] ${uiSelect}`}
            >
              {ALLOWED_UNITS.map((u) => (
                <option key={u} value={u}>
                  {STOCK_UNIT_LABEL_FR[u]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-0.5">
            <span className={uiLabel}>Type</span>
            <select
              value={createType}
              onChange={(e) => setCreateType(e.target.value as "ingredient" | "prep" | "resale")}
              className={uiSelect}
            >
              {ITEM_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-0.5">
            <span className={uiLabel}>Stock de base</span>
            <input
              type="text"
              inputMode="decimal"
              value={createStockQty}
              onChange={(e) => setCreateStockQty(e.target.value)}
              placeholder="0"
              className={`w-20 ${uiInput}`}
            />
          </label>
          <label className="flex flex-col gap-0.5">
            <span className={uiLabel}>Quantité</span>
            <input
              type="text"
              inputMode="decimal"
              value={createQty}
              onChange={(e) => setCreateQty(e.target.value)}
              placeholder="Qté"
              className={`w-20 ${uiInput}`}
              required
            />
          </label>
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={loading || !createName.trim() || !createQty.trim()}
            className="rounded bg-violet-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-800 disabled:opacity-50"
          >
            {loading ? "…" : "Créer et ajouter"}
          </button>
          <button
            type="button"
            onClick={() => {
              setShowCreateForm(false);
              setCreateName("");
              setCreateUnit("unit");
              setCreateStockQty("");
              setCreateQty("");
            }}
            className={uiBtnOutlineSm}
          >
            Annuler
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="space-y-2">
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="rechercher un composant..."
        className={`w-full ${uiInput}`}
        disabled={disabled}
        autoComplete="off"
      />
      {hasMatches && (
        <ul className="max-h-48 overflow-auto rounded-xl border border-slate-100 bg-white shadow-sm">
          {matches.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => setSelectedItem(item)}
                className="w-full px-3 py-2 text-left text-sm transition hover:bg-indigo-50/60"
              >
                {item.name} <span className="text-slate-500">({item.unit})</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {showCreateOption && (
        <button
          type="button"
          onClick={openCreateForm}
          className="flex items-center gap-1 text-sm text-violet-700 hover:underline"
        >
          + Créer « {search.trim()} »
        </button>
      )}
    </div>
  );
}
