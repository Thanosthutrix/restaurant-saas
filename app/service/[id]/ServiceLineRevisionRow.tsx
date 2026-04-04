"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { GroupedDisplayLine } from "./ServiceLinesRevisionBlock";
import {
  updateServiceLines,
  associateServiceLinesToDish,
  ignoreServiceLines,
  unignoreServiceLines,
  createDishAndAssociateServiceLines,
} from "./actions";

export function ServiceLineRevisionRow({
  displayLine,
  rowIndex,
  dishes,
  restaurantId,
}: {
  displayLine: GroupedDisplayLine;
  rowIndex: number;
  dishes: { id: string; name: string }[];
  restaurantId: string;
}) {
  const router = useRouter();
  const { lineIds, raw_label, normalized_label, qty, dish_id, ignored, dish } = displayLine;
  const [qtyInput, setQtyInput] = useState(String(qty));
  const [savingQty, setSavingQty] = useState(false);
  const [showDishSelect, setShowDishSelect] = useState(false);
  const [showNewDishInput, setShowNewDishInput] = useState(false);
  const [newDishName, setNewDishName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSaveQty() {
    const num = parseFloat(qtyInput.replace(",", "."));
    if (!Number.isFinite(num) || num <= 0) {
      setError("Quantité invalide.");
      return;
    }
    setError(null);
    setSavingQty(true);
    const result = await updateServiceLines(lineIds, restaurantId, { qty: num });
    setSavingQty(false);
    if (result.ok) router.refresh();
    else setError(result.error);
  }

  async function handleAssociate(dishId: string) {
    setLoading(true);
    setError(null);
    const result = await associateServiceLinesToDish(lineIds, restaurantId, dishId);
    setLoading(false);
    if (result.ok) {
      setShowDishSelect(false);
      router.refresh();
    } else setError(result.error);
  }

  async function handleIgnore() {
    setLoading(true);
    setError(null);
    const result = await ignoreServiceLines(lineIds, restaurantId);
    setLoading(false);
    if (result.ok) router.refresh();
    else setError(result.error);
  }

  async function handleUnignore() {
    setLoading(true);
    setError(null);
    const result = await unignoreServiceLines(lineIds, restaurantId);
    setLoading(false);
    if (result.ok) router.refresh();
    else setError(result.error);
  }

  async function handleCreateDishAndAssociate() {
    const name = newDishName.trim();
    if (!name) return;
    setLoading(true);
    setError(null);
    const result = await createDishAndAssociateServiceLines(restaurantId, lineIds, name);
    setLoading(false);
    if (result.ok) {
      setShowNewDishInput(false);
      setNewDishName("");
      router.refresh();
    } else setError(result.error);
  }

  const isRecognized = dish_id != null && !ignored;
  const isUnrecognized = dish_id == null && !ignored;
  const isIgnored = ignored;

  return (
    <tr
      className={`border-b border-slate-100 ${isIgnored ? "opacity-60 bg-slate-50" : ""}`}
    >
      <td className="py-2 pr-2 text-slate-500">{rowIndex + 1}</td>
      <td className="py-2 pr-2 font-medium text-slate-900">{raw_label}</td>
      <td className="py-2 pr-2 text-xs text-slate-600">{normalized_label || "—"}</td>
      <td className="py-2 pr-2">
        <div className="flex items-center gap-1">
          <input
            type="text"
            inputMode="decimal"
            value={qtyInput}
            onChange={(e) => setQtyInput(e.target.value)}
            disabled={isIgnored}
            className="w-14 rounded border border-slate-300 px-2 py-1 text-sm disabled:opacity-50"
          />
          {!isIgnored && (
            <button
              type="button"
              disabled={savingQty}
              onClick={handleSaveQty}
              className="rounded border border-slate-300 px-2 py-0.5 text-xs hover:bg-slate-100"
            >
              {savingQty ? "…" : "Ok"}
            </button>
          )}
        </div>
      </td>
      <td className="py-2 pr-2">
        {isIgnored && <span className="text-slate-500">Ignorée</span>}
        {isRecognized && <span className="text-emerald-600">Reconnu</span>}
        {isUnrecognized && <span className="text-amber-600">Non reconnu</span>}
      </td>
      <td className="py-2 pr-2">
        {dish ? (
          <span className="text-slate-900">{dish.name}</span>
        ) : (
          <span className="text-slate-400">—</span>
        )}
      </td>
      <td className="py-2">
        {error && <p className="mb-1 text-xs text-red-600">{error}</p>}
        <div className="flex flex-wrap gap-1">
          {isIgnored && (
            <button
              type="button"
              disabled={loading}
              onClick={handleUnignore}
              className="rounded border border-slate-300 px-2 py-0.5 text-xs hover:bg-slate-100 disabled:opacity-50"
            >
              Réactiver
            </button>
          )}
          {isRecognized && (
            <>
              <button
                type="button"
                disabled={loading}
                onClick={() => { setShowDishSelect(!showDishSelect); setShowNewDishInput(false); }}
                className="rounded border border-slate-300 px-2 py-0.5 text-xs hover:bg-slate-100 disabled:opacity-50"
              >
                Changer le plat
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={handleIgnore}
                className="rounded border border-amber-200 px-2 py-0.5 text-xs text-amber-700 hover:bg-amber-50 disabled:opacity-50"
              >
                Ignorer
              </button>
            </>
          )}
          {isUnrecognized && (
            <>
              <button
                type="button"
                disabled={loading}
                onClick={() => { setShowDishSelect(!showDishSelect); setShowNewDishInput(false); }}
                className="rounded border border-slate-300 px-2 py-0.5 text-xs hover:bg-slate-100 disabled:opacity-50"
              >
                Associer à un plat
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => { setShowNewDishInput(!showNewDishInput); setShowDishSelect(false); }}
                className="rounded border border-violet-300 px-2 py-0.5 text-xs text-violet-700 hover:bg-violet-50 disabled:opacity-50"
              >
                Nouveau plat
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={handleIgnore}
                className="rounded border border-amber-200 px-2 py-0.5 text-xs text-amber-700 hover:bg-amber-50 disabled:opacity-50"
              >
                Ignorer
              </button>
            </>
          )}
        </div>
        {showDishSelect && (
          <div className="mt-2">
            <select
              className="w-full max-w-xs rounded border border-slate-300 px-2 py-1 text-sm"
              value=""
              onChange={(e) => { const id = e.target.value; if (id) handleAssociate(id); }}
              aria-label="Choisir un plat"
            >
              <option value="">Choisir un plat…</option>
              {dishes.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
        )}
        {showNewDishInput && (
          <div className="mt-2 flex gap-1">
            <input
              type="text"
              value={newDishName}
              onChange={(e) => setNewDishName(e.target.value)}
              placeholder="Nom du nouveau plat"
              className="rounded border border-slate-300 px-2 py-1 text-sm"
            />
            <button
              type="button"
              disabled={loading || !newDishName.trim()}
              onClick={handleCreateDishAndAssociate}
              className="rounded bg-violet-600 px-2 py-1 text-xs text-white hover:bg-violet-700 disabled:opacity-50"
            >
              Créer et associer
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}
