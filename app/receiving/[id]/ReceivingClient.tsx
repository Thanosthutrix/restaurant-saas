"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type {
  DeliveryNoteWithLines,
  InventoryItem,
  InvoiceExtractedLineOption,
} from "@/lib/db";
import { updateDeliveryNoteLinesAction, validateReceptionAction, addDeliveryNoteLineAction } from "./actions";

type Line = DeliveryNoteWithLines["lines"][number];

/** Quantités et prix : nombre (serveur) ou chaîne (saisie). */
type EditableLine = Omit<
  Line,
  | "qty_delivered"
  | "qty_received"
  | "bl_line_total_ht"
  | "bl_unit_price_stock_ht"
  | "manual_unit_price_stock_ht"
> & {
  qty_delivered: number | string;
  qty_received: number | string;
  bl_line_total_ht?: number | string | null;
  bl_unit_price_stock_ht?: number | string | null;
  manual_unit_price_stock_ht?: number | string | null;
  supplier_invoice_extracted_line_id?: string | null;
};

function parseOptionalMoney(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(String(raw).replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function moneyInputValue(
  line: EditableLine,
  field: "bl_line_total_ht" | "bl_unit_price_stock_ht" | "manual_unit_price_stock_ht"
): string {
  const v = line[field];
  if (v === undefined || v === null) return "";
  const s = String(v);
  return s.trim() === "" ? "" : s;
}

function displayBlMoney(
  v: number | string | null | undefined,
  maxFractionDigits: number
): string {
  if (v === undefined || v === null) return "—";
  if (typeof v === "string" && v.trim() === "") return "—";
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) return "—";
  return n.toLocaleString("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxFractionDigits,
  });
}

type Props = {
  deliveryNote: DeliveryNoteWithLines;
  inventoryItems: InventoryItem[];
  linkedInvoiceId: string | null;
  invoiceExtractedLines: InvoiceExtractedLineOption[];
};

export function ReceivingClient({
  deliveryNote,
  inventoryItems,
  linkedInvoiceId,
  invoiceExtractedLines,
}: Props) {
  const [lines, setLines] = useState<EditableLine[]>(deliveryNote.lines as EditableLine[]);
  const [saving, startSaving] = useTransition();
  const [validating, startValidating] = useTransition();
  const [addingLinePending, startAddingLine] = useTransition();
  const [addingLine, setAddingLine] = useState(false);
  const [addLineError, setAddLineError] = useState<string | null>(null);
  const [validateError, setValidateError] = useState<string | null>(null);
  const router = useRouter();

  const readOnly = deliveryNote.status === "validated";

  const [newLabel, setNewLabel] = useState("");
  const [newInventoryItemId, setNewInventoryItemId] = useState<string>("");
  const [newQtyDelivered, setNewQtyDelivered] = useState("");
  const [newQtyReceived, setNewQtyReceived] = useState("");
  const [newUnit, setNewUnit] = useState("");
  const [newBlLineTotal, setNewBlLineTotal] = useState("");
  const [newBlUnitPrice, setNewBlUnitPrice] = useState("");
  const [newManualPrice, setNewManualPrice] = useState("");
  const [newExtractedLineId, setNewExtractedLineId] = useState<string>("");

  function extractedLineShortLabel(id: string | null | undefined): string {
    if (!id) return "—";
    const o = invoiceExtractedLines.find((x) => x.id === id);
    if (!o) return id.slice(0, 8) + "…";
    const t = o.label.length > 48 ? `${o.label.slice(0, 48)}…` : o.label;
    return t;
  }

  function getRatio(line: EditableLine): number {
    return line.purchase_to_stock_ratio != null && line.purchase_to_stock_ratio > 0
      ? line.purchase_to_stock_ratio
      : 1;
  }

  function onChangeLine(id: string, field: "qty_delivered" | "qty_received", value: string) {
    setLines((prev) =>
      prev.map((l): EditableLine => {
        if (l.id !== id) return l;
        const num = value.replace(",", ".");
        const parsed = Number(num);
        if (field === "qty_delivered") {
          const qtyDelivered = Number.isFinite(parsed) ? parsed : (Number(l.qty_delivered) || 0);
          const ratio = getRatio(l);
          const qtyReceived = Math.round(qtyDelivered * ratio * 1000) / 1000;
          return { ...l, qty_delivered: value, qty_received: String(qtyReceived) };
        }
        return { ...l, [field]: value };
      })
    );
  }

  function onChangeBlLine(id: string, field: "bl_line_total_ht" | "bl_unit_price_stock_ht", value: string) {
    setLines((prev) =>
      prev.map((l): EditableLine => (l.id === id ? { ...l, [field]: value } : l))
    );
  }

  function onChangeManualLine(id: string, value: string) {
    setLines((prev) =>
      prev.map((l): EditableLine => (l.id === id ? { ...l, manual_unit_price_stock_ht: value } : l))
    );
  }

  function onChangeExtractedLink(id: string, value: string) {
    setLines((prev) =>
      prev.map((l): EditableLine =>
        l.id === id
          ? { ...l, supplier_invoice_extracted_line_id: value === "" ? null : value }
          : l
      )
    );
  }

  function getQty(line: EditableLine, field: "qty_ordered" | "qty_delivered" | "qty_received"): number {
    const raw = line[field];
    const n = typeof raw === "string" ? Number(raw) : Number(raw);
    return Number.isFinite(n) ? n : 0;
  }

  function computeDiffStock(line: EditableLine): number {
    const ratio = getRatio(line);
    const orderedStock = (Number(line.qty_ordered) || 0) * ratio;
    const received = getQty(line, "qty_received");
    return Math.round((received - orderedStock) * 1000) / 1000;
  }

  function handleSave() {
    setValidateError(null);
    startSaving(() => {
      updateDeliveryNoteLinesAction(
        deliveryNote.id,
        lines.map((l) => ({
          id: l.id,
          qty_delivered: getQty(l, "qty_delivered"),
          qty_received: getQty(l, "qty_received"),
          bl_line_total_ht: parseOptionalMoney(l.bl_line_total_ht),
          bl_unit_price_stock_ht: parseOptionalMoney(l.bl_unit_price_stock_ht),
          manual_unit_price_stock_ht: parseOptionalMoney(l.manual_unit_price_stock_ht),
          supplier_invoice_extracted_line_id: l.supplier_invoice_extracted_line_id ?? null,
        }))
      )
        .then(() => router.refresh())
        .catch(() => {});
    });
  }

  function handleValidate() {
    if (
      !confirm(
        "Valider la réception ? Le stock sera incrémenté sur la base des quantités reçues (lignes avec produit lié)."
      )
    )
      return;
    setValidateError(null);
    startValidating(() => {
      validateReceptionAction(deliveryNote.id, deliveryNote.restaurant_id)
        .then(() => router.refresh())
        .catch((e: unknown) => {
          setValidateError(e instanceof Error ? e.message : "Erreur lors de la validation.");
        });
    });
  }

  function openAddLineForm() {
    setAddingLine(true);
    setAddLineError(null);
    setNewLabel("");
    setNewInventoryItemId("");
    setNewQtyDelivered("");
    setNewQtyReceived("");
    setNewUnit("");
    setNewBlLineTotal("");
    setNewBlUnitPrice("");
    setNewManualPrice("");
    setNewExtractedLineId("");
  }

  function closeAddLineForm() {
    setAddingLine(false);
    setAddLineError(null);
  }

  function onSelectInventoryItem(itemId: string) {
    setNewInventoryItemId(itemId);
    if (itemId) {
      const item = inventoryItems.find((i) => i.id === itemId);
      if (item) setNewUnit(item.unit ?? item.purchase_unit ?? "");
    }
  }

  function handleAddLine() {
    setAddLineError(null);
    const label = newLabel.trim() || "Ligne";
    const qtyDelivered = Number(newQtyDelivered.replace(",", ".")) || 0;
    const qtyReceived = Number(newQtyReceived.replace(",", ".")) || 0;
    if (qtyDelivered < 0 || qtyReceived < 0) {
      setAddLineError("Les quantités doivent être positives ou nulles.");
      return;
    }
    startAddingLine(() => {
      addDeliveryNoteLineAction(deliveryNote.id, {
        label,
        inventory_item_id: newInventoryItemId || null,
        qty_delivered: qtyDelivered,
        qty_received: qtyReceived,
        unit: newUnit.trim() || null,
        sort_order: lines.length,
        bl_line_total_ht: parseOptionalMoney(newBlLineTotal),
        bl_unit_price_stock_ht: parseOptionalMoney(newBlUnitPrice),
        manual_unit_price_stock_ht: parseOptionalMoney(newManualPrice),
        supplier_invoice_extracted_line_id: newExtractedLineId === "" ? null : newExtractedLineId,
      })
        .then(() => {
          closeAddLineForm();
          router.refresh();
        })
        .catch((e: unknown) => {
          setAddLineError(e instanceof Error ? e.message : "Erreur à l'ajout de la ligne.");
        });
    });
  }

  const hasLinesWithoutProduct = lines.some((l) => !l.inventory_item_id);
  const emptyLines = lines.length === 0;

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded border border-slate-200 bg-white">
        {emptyLines && !addingLine ? (
          <div className="px-4 py-8 text-center">
            <p className="text-sm text-slate-600">
              Aucune ligne de réception trouvée
            </p>
            {!readOnly && (
              <button
                type="button"
                onClick={openAddLineForm}
                className="mt-3 rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
              >
                Ajouter une ligne
              </button>
            )}
          </div>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="pb-2 pr-2">Produit / libellé</th>
                  <th className="pb-2 pr-2 text-right">Qté commandée (achat)</th>
                  <th className="pb-2 pr-2 text-right">Qté livrée (achat)</th>
                  <th className="pb-2 pr-2 text-right">Qté reçue (stock)</th>
                  <th className="pb-2 pr-2">Unité achat</th>
                  <th className="pb-2 pr-2">Unité stock</th>
                  <th
                    className="pb-2 pr-2 text-right min-w-[6rem]"
                    title="Prioritaire sur liaison facture et prix BL"
                  >
                    Prix manuel (€/u.)
                  </th>
                  <th className="pb-2 pr-2 min-w-[10rem]">Ligne facture</th>
                  <th className="pb-2 pr-2 text-right" title="Total HT de la ligne sur le BL">
                    Total ligne HT (€)
                  </th>
                  <th className="pb-2 pr-2 text-right" title="Prix unitaire HT en unité de stock (priorité si pas de total)">
                    Prix u. stock HT (€)
                  </th>
                  <th className="pb-2 pr-2 text-right">Écart (stock)</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => {
                  const diff = computeDiffStock(line);
                  const qtyDeliveredDisplay = getQty(line, "qty_delivered");
                  const qtyReceivedDisplay = getQty(line, "qty_received");
                  const noProduct = !line.inventory_item_id;
                  return (
                    <tr key={line.id} className="border-b border-slate-100">
                      <td className="py-2 pr-2">
                        <div className="font-medium text-slate-900">
                          {line.inventory_items?.name ?? line.label}
                        </div>
                        {line.label && line.inventory_items?.name !== line.label && (
                          <div className="text-xs text-slate-500">{line.label}</div>
                        )}
                        {noProduct && (
                          <span className="text-xs text-amber-600">
                            Sans produit lié (non mis en stock)
                          </span>
                        )}
                      </td>
                      <td className="py-2 pr-2 text-right text-slate-600">
                        {Number(line.qty_ordered) || 0}
                      </td>
                      <td className="py-2 pr-2 text-right">
                        {readOnly ? (
                          <span className="text-slate-600">{qtyDeliveredDisplay}</span>
                        ) : (
                          <input
                            type="number"
                            min={0}
                            step="any"
                            value={
                              typeof line.qty_delivered === "string"
                                ? line.qty_delivered
                                : qtyDeliveredDisplay
                            }
                            onChange={(e) => onChangeLine(line.id, "qty_delivered", e.target.value)}
                            className="w-20 rounded border border-slate-300 px-2 py-1 text-right text-sm"
                          />
                        )}
                      </td>
                      <td className="py-2 pr-2 text-right">
                        {readOnly ? (
                          <span className="text-slate-600">{qtyReceivedDisplay}</span>
                        ) : (
                          <input
                            type="number"
                            min={0}
                            step="any"
                            value={
                              typeof line.qty_received === "string"
                                ? line.qty_received
                                : qtyReceivedDisplay
                            }
                            onChange={(e) => onChangeLine(line.id, "qty_received", e.target.value)}
                            className="w-20 rounded border border-slate-300 px-2 py-1 text-right text-sm"
                          />
                        )}
                      </td>
                      <td className="py-2 pr-2 text-slate-600">{line.unit ?? "—"}</td>
                      <td className="py-2 pr-2 text-slate-600">
                        {line.stock_unit ?? "—"}
                      </td>
                      <td className="py-2 pr-2 text-right">
                        {readOnly ? (
                          <span className="text-slate-600">
                            {displayBlMoney(line.manual_unit_price_stock_ht, 4)}
                          </span>
                        ) : (
                          <input
                            type="text"
                            inputMode="decimal"
                            placeholder="—"
                            value={moneyInputValue(line, "manual_unit_price_stock_ht")}
                            onChange={(e) => onChangeManualLine(line.id, e.target.value)}
                            className="w-24 rounded border border-slate-300 px-2 py-1 text-right text-sm"
                          />
                        )}
                      </td>
                      <td className="py-2 pr-2">
                        {readOnly ? (
                          <span className="text-xs text-slate-600">
                            {extractedLineShortLabel(line.supplier_invoice_extracted_line_id)}
                          </span>
                        ) : (
                          <select
                            value={line.supplier_invoice_extracted_line_id ?? ""}
                            onChange={(e) => onChangeExtractedLink(line.id, e.target.value)}
                            disabled={
                              !linkedInvoiceId || invoiceExtractedLines.length === 0
                            }
                            className="max-w-[12rem] truncate rounded border border-slate-300 px-1 py-1 text-xs disabled:opacity-50"
                          >
                            <option value="">—</option>
                            {invoiceExtractedLines.map((el) => (
                              <option key={el.id} value={el.id}>
                                {(el.line_total != null
                                  ? `${el.line_total.toFixed(2)} € — `
                                  : "") + el.label.slice(0, 40)}
                                {el.label.length > 40 ? "…" : ""}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td className="py-2 pr-2 text-right">
                        {readOnly ? (
                          <span className="text-slate-600">
                            {displayBlMoney(line.bl_line_total_ht, 2)}
                          </span>
                        ) : (
                          <input
                            type="text"
                            inputMode="decimal"
                            placeholder="—"
                            value={moneyInputValue(line, "bl_line_total_ht")}
                            onChange={(e) =>
                              onChangeBlLine(line.id, "bl_line_total_ht", e.target.value)
                            }
                            className="w-24 rounded border border-slate-300 px-2 py-1 text-right text-sm"
                          />
                        )}
                      </td>
                      <td className="py-2 pr-2 text-right">
                        {readOnly ? (
                          <span className="text-slate-600">
                            {displayBlMoney(line.bl_unit_price_stock_ht, 4)}
                          </span>
                        ) : (
                          <input
                            type="text"
                            inputMode="decimal"
                            placeholder="—"
                            value={moneyInputValue(line, "bl_unit_price_stock_ht")}
                            onChange={(e) =>
                              onChangeBlLine(line.id, "bl_unit_price_stock_ht", e.target.value)
                            }
                            className="w-24 rounded border border-slate-300 px-2 py-1 text-right text-sm"
                          />
                        )}
                      </td>
                      <td className="py-2 pr-2 text-right">
                        <span
                          className={
                            diff === 0
                              ? "text-xs text-emerald-600"
                              : "text-xs text-amber-700"
                          }
                        >
                          {diff > 0 ? `+${diff}` : diff}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!readOnly && (
              <div className="border-t border-slate-200 px-3 py-2">
                <p className="mb-2 text-xs text-slate-500">
                  <strong>Ordre du coût unitaire stock (€ HT)</strong> : 1) prix manuel, 2) ligne facture choisie
                  (facture liée à la réception), 3) total ligne BL ÷ qté reçue ou prix u. BL, 4) rapprochement
                  automatique par libellé sur la facture, 5) dernier achat connu. Liez une facture à la réception
                  pour activer la liste « Ligne facture ».
                </p>
                <button
                  type="button"
                  onClick={openAddLineForm}
                  className="text-sm font-medium text-slate-600 underline"
                >
                  Ajouter une ligne
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {addingLine && (
        <div className="rounded border border-slate-200 bg-slate-50 p-4">
          <h3 className="mb-3 text-sm font-medium text-slate-700">
            Nouvelle ligne de réception
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-slate-500">
                Libellé
              </label>
              <input
                type="text"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="ex. Tomates"
                className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">
                Produit (optionnel, pour mise en stock)
              </label>
              <select
                value={newInventoryItemId}
                onChange={(e) => onSelectInventoryItem(e.target.value)}
                className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
              >
                <option value="">— Aucun —</option>
                {inventoryItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">
                Unité
              </label>
              <input
                type="text"
                value={newUnit}
                onChange={(e) => setNewUnit(e.target.value)}
                placeholder="ex. kg"
                className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">
                Qté livrée (achat)
              </label>
              <input
                type="number"
                min={0}
                step="any"
                value={newQtyDelivered}
                onChange={(e) => setNewQtyDelivered(e.target.value)}
                className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">
                Qté reçue (stock)
              </label>
              <input
                type="number"
                min={0}
                step="any"
                value={newQtyReceived}
                onChange={(e) => setNewQtyReceived(e.target.value)}
                className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">
                Prix manuel € / unité stock (prioritaire)
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={newManualPrice}
                onChange={(e) => setNewManualPrice(e.target.value)}
                placeholder="optionnel"
                className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-slate-500">
                Ligne facture (si facture liée à la réception)
              </label>
              <select
                value={newExtractedLineId}
                onChange={(e) => setNewExtractedLineId(e.target.value)}
                disabled={!linkedInvoiceId || invoiceExtractedLines.length === 0}
                className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm disabled:opacity-50"
              >
                <option value="">— Aucune —</option>
                {invoiceExtractedLines.map((el) => (
                  <option key={el.id} value={el.id}>
                    {(el.line_total != null ? `${el.line_total.toFixed(2)} € — ` : "") + el.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">
                Total ligne HT sur BL (€)
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={newBlLineTotal}
                onChange={(e) => setNewBlLineTotal(e.target.value)}
                placeholder="optionnel"
                className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">
                Prix unit. stock HT (€)
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={newBlUnitPrice}
                onChange={(e) => setNewBlUnitPrice(e.target.value)}
                placeholder="optionnel"
                className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
              />
            </div>
          </div>
          {addLineError && (
            <p className="mt-2 text-sm text-red-600" role="alert">
              {addLineError}
            </p>
          )}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={handleAddLine}
              disabled={addingLinePending}
              className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {addingLinePending ? "Ajout…" : "Enregistrer la ligne"}
            </button>
            <button
              type="button"
              onClick={closeAddLineForm}
              disabled={addingLinePending}
              className="rounded border border-slate-400 px-3 py-1.5 text-sm font-medium text-slate-700"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {hasLinesWithoutProduct && !readOnly && (
        <p className="text-xs text-amber-700">
          Les lignes sans produit lié ne seront pas mises en stock à la validation.
        </p>
      )}

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          {!readOnly && (
            <>
              <button
                type="button"
                disabled={saving || emptyLines}
                onClick={handleSave}
                className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {saving ? "Enregistrement…" : "Enregistrer"}
              </button>
              <button
                type="button"
                disabled={validating || emptyLines}
                onClick={handleValidate}
                className="rounded bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-50"
              >
                {validating ? "Validation…" : "Valider la réception"}
              </button>
            </>
          )}
          {readOnly && (
            <span className="text-sm text-emerald-700">
              Réception validée. Les lignes avec produit lié ont été mises en stock.
            </span>
          )}
        </div>
        {validateError && (
          <p className="text-sm text-red-600" role="alert">
            {validateError}
          </p>
        )}
      </div>
    </div>
  );
}
