"use client";

import { useEffect, useState, useTransition } from "react";
import { AlertTriangle, Plus } from "lucide-react";
import { logSupplyBreakageAction } from "./actions";
import { ModalOverlay } from "@/components/ui/ModalOverlay";
import type { WasteLogRow } from "@/lib/analysis/wasteDb";
import {
  uiBtnPrimary,
  uiBtnSecondary,
  uiCard,
  uiError,
  uiInput,
  uiLabel,
  uiLead,
  uiMuted,
} from "@/components/ui/premium";

type SupplyOption = { id: string; name: string; unit: string; stock: number };

type Props = {
  restaurantId: string;
  supplies: SupplyOption[];
  initialLogs: WasteLogRow[];
  itemNames: Record<string, string>;
  sheetOpen: boolean;
  preselectedId: string | null;
  onSheetOpenChange: (open: boolean) => void;
};

function BreakageSheet({
  open,
  restaurantId,
  supplies,
  preselectedId,
  onClose,
  onLogged,
}: {
  open: boolean;
  restaurantId: string;
  supplies: SupplyOption[];
  preselectedId: string | null;
  onClose: () => void;
  onLogged: () => void;
}) {
  const [inventoryItemId, setInventoryItemId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (open) {
      setInventoryItemId(preselectedId ?? "");
      setQuantity("1");
      setNotes("");
      setError(null);
    }
  }, [open, preselectedId]);

  if (!open) return null;

  const selected = supplies.find((s) => s.id === inventoryItemId);

  const close = () => {
    onClose();
  };

  const submit = () => {
    const qty = Number(quantity.replace(",", "."));
    if (!inventoryItemId) {
      setError("Sélectionnez un article.");
      return;
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      setError("Indiquez une quantité valide.");
      return;
    }
    if (selected && qty > selected.stock + 1e-9) {
      setError(`Stock insuffisant (${selected.stock} pièce(s) en stock).`);
      return;
    }

    setError(null);
    startTransition(async () => {
      const res = await logSupplyBreakageAction({
        restaurantId,
        inventoryItemId,
        quantity: qty,
        unit: selected?.unit ?? "unit",
        notes: notes.trim() || null,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onLogged();
      close();
    });
  };

  return (
    <ModalOverlay ariaLabel="Déclarer une casse" onClose={close}>
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-stone-200/80 bg-white shadow-2xl">
        <div className="border-b border-stone-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-stone-900">Déclarer une casse</h2>
          <p className={uiLead}>Verre cassé, assiette fêlée… Le stock sera décrémenté.</p>
        </div>
        <div className="space-y-3 px-4 py-4">
          {error ? <p className={uiError}>{error}</p> : null}

          <label className="flex flex-col gap-1">
            <span className={uiLabel}>Article</span>
            <select
              value={inventoryItemId}
              onChange={(e) => setInventoryItemId(e.target.value)}
              className="h-11 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm"
            >
              <option value="">Choisir…</option>
              {supplies.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.stock} en stock)
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className={uiLabel}>Quantité cassée</span>
            <input
              type="text"
              inputMode="decimal"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className={`${uiInput} h-11 w-full`}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className={uiLabel}>Note (opt.)</span>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="ex. service du midi, table 12"
              className={`${uiInput} h-11 w-full`}
            />
          </label>
        </div>
        <div className="flex justify-end gap-2 border-t border-stone-100 px-4 py-3">
          <button type="button" className={uiBtnSecondary} onClick={close} disabled={pending}>
            Annuler
          </button>
          <button type="button" className={uiBtnPrimary} onClick={submit} disabled={pending}>
            {pending ? "Enregistrement…" : "Enregistrer la casse"}
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}

export function SupplyBreakageClient({
  restaurantId,
  supplies,
  initialLogs,
  itemNames,
  sheetOpen,
  preselectedId,
  onSheetOpenChange,
}: Props) {
  return (
    <div className="space-y-4">
      <button
        type="button"
        className={`${uiBtnPrimary} inline-flex items-center gap-2`}
        onClick={() => onSheetOpenChange(true)}
      >
        <Plus className="h-4 w-4" aria-hidden />
        Déclarer une casse
      </button>

      <section className={uiCard}>
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-stone-900">
          <AlertTriangle className="h-4 w-4 text-amber-600" aria-hidden />
          Dernières casses
        </h3>
        {initialLogs.length === 0 ? (
          <p className={uiMuted}>Aucune casse enregistrée pour l&apos;instant.</p>
        ) : (
          <ul className="divide-y divide-stone-100">
            {initialLogs.map((log) => (
              <li key={log.id} className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0">
                <div>
                  <p className="text-sm font-medium text-stone-900">
                    {log.inventory_item_id ? itemNames[log.inventory_item_id] ?? "Article" : "—"}
                  </p>
                  <p className={uiMuted}>
                    {log.quantity} pièce(s)
                    {log.estimated_cost_ht != null ? ` · ~${log.estimated_cost_ht.toFixed(2)} € HT` : ""}
                    {log.notes ? ` · ${log.notes}` : ""}
                  </p>
                </div>
                <time className={uiMuted} dateTime={log.logged_at}>
                  {new Intl.DateTimeFormat("fr-FR", {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  }).format(new Date(log.logged_at))}
                </time>
              </li>
            ))}
          </ul>
        )}
      </section>

      <BreakageSheet
        open={sheetOpen}
        restaurantId={restaurantId}
        supplies={supplies}
        preselectedId={preselectedId}
        onClose={() => onSheetOpenChange(false)}
        onLogged={() => {
          window.location.reload();
        }}
      />
    </div>
  );
}
