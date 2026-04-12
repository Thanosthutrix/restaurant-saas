"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { DeliveryNoteWithLines, InventoryItem, ReceptionTraceabilityPhoto } from "@/lib/db";
import { supabase } from "@/lib/supabaseClient";
import { DELIVERY_NOTES_BUCKET, TRACEABILITY_ELEMENT_LABEL_FR, TRACEABILITY_ELEMENT_TYPES } from "@/lib/constants";
import { Camera, Check, Loader2 } from "lucide-react";
import {
  updateDeliveryNoteLinesAction,
  validateReceptionAction,
  addDeliveryNoteLineAction,
  setDeliveryNoteLineInventoryItemAction,
  saveDeliveryLabelAliasAction,
  recordTraceabilityPhotoAction,
  deleteTraceabilityPhotoAction,
  toggleDeliveryNoteLineVerifiedAction,
} from "./actions";
import {
  findInventoryMatchCandidates,
  type InventoryCandidate,
} from "@/lib/matching/findInventoryMatchCandidates";
import { computeDeliveryLabelCore } from "@/lib/matching/deliveryLabelCore";
import { normalizeInventoryItemName } from "@/lib/recipes/normalizeInventoryItemName";

function buildInventorySelectOptions(
  lineLabel: string,
  inventoryItems: InventoryItem[],
  aliasMap?: Map<string, string>
): { suggested: InventoryCandidate[]; rest: InventoryItem[] } {
  const { candidates } = findInventoryMatchCandidates(lineLabel, inventoryItems, { aliasMap });
  const suggestedIds = new Set(candidates.map((c) => c.id));
  const rest = inventoryItems
    .filter((i) => !suggestedIds.has(i.id))
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));
  return { suggested: candidates.slice(0, 10), rest };
}

function traceabilityTypeLabel(code: string): string {
  return (TRACEABILITY_ELEMENT_TYPES as readonly string[]).includes(code)
    ? TRACEABILITY_ELEMENT_LABEL_FR[code as keyof typeof TRACEABILITY_ELEMENT_LABEL_FR]
    : code;
}

function lineHasSavedAlias(
  label: string,
  inventoryItemId: string | null | undefined,
  aliasMap: Map<string, string>
): boolean {
  if (!inventoryItemId) return false;
  const full = normalizeInventoryItemName(label);
  const core = computeDeliveryLabelCore(label);
  const hit = aliasMap.get(full) ?? aliasMap.get(core);
  return hit === inventoryItemId;
}

type Line = DeliveryNoteWithLines["lines"][number];

/** Quantités et prix : nombre (serveur) ou chaîne (saisie). */
type EditableLine = Omit<
  Line,
  | "qty_delivered"
  | "qty_received"
  | "bl_line_total_ht"
  | "bl_unit_price_stock_ht"
  | "manual_unit_price_stock_ht"
  | "received_temperature_celsius"
  | "lot_number"
  | "expiry_date"
> & {
  qty_delivered: number | string;
  qty_received: number | string;
  bl_line_total_ht?: number | string | null;
  bl_unit_price_stock_ht?: number | string | null;
  manual_unit_price_stock_ht?: number | string | null;
  supplier_invoice_extracted_line_id?: string | null;
  received_temperature_celsius?: number | string | null;
  lot_number?: string | null;
  expiry_date?: string | null;
  traceability_photos?: ReceptionTraceabilityPhoto[];
};

function parseOptionalMoney(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(String(raw).replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Température °C à la réception (hygiène) ; plage large pour surgelé / chaud. */
function parseOptionalTemperature(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(String(raw).replace(",", "."));
  if (!Number.isFinite(n)) return null;
  if (n < -60 || n > 100) return null;
  return Math.round(n * 10) / 10;
}

function temperatureInputValue(line: EditableLine): string {
  const v = line.received_temperature_celsius;
  if (v === undefined || v === null) return "";
  const s = String(v);
  return s.trim() === "" ? "" : s;
}

function lotInputValue(line: EditableLine): string {
  const v = line.lot_number;
  if (v === undefined || v === null) return "";
  return String(v);
}

function expiryInputValue(line: EditableLine): string {
  const v = line.expiry_date;
  if (v === undefined || v === null || v === "") return "";
  const s = String(v);
  return s.length >= 10 ? s.slice(0, 10) : s;
}

function moneyInputValue(
  line: EditableLine,
  field: "bl_line_total_ht" | "bl_unit_price_stock_ht"
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
  /** Libellés mémorisés (clé normalisée → inventory_item_id), pour suggestions et affichage. */
  deliveryLabelAliases: Record<string, string>;
};

export function ReceivingClient({
  deliveryNote,
  inventoryItems,
  deliveryLabelAliases,
}: Props) {
  const [lines, setLines] = useState<EditableLine[]>(deliveryNote.lines as EditableLine[]);
  const [saving, startSaving] = useTransition();
  const [validating, startValidating] = useTransition();
  const [addingLinePending, startAddingLine] = useTransition();
  const [addingLine, setAddingLine] = useState(false);
  const [addLineError, setAddLineError] = useState<string | null>(null);
  const [validateError, setValidateError] = useState<string | null>(null);
  const [pendingInventoryLineId, setPendingInventoryLineId] = useState<string | null>(null);
  const [savingAliasLineId, setSavingAliasLineId] = useState<string | null>(null);
  const router = useRouter();

  const deliveryLabelAliasMap = useMemo(
    () => new Map<string, string>(Object.entries(deliveryLabelAliases)),
    [deliveryLabelAliases]
  );

  const readOnly = deliveryNote.status === "validated";

  /** Après lecture BL ou refresh, les nouvelles lignes arrivent en props mais useState gardait l’ancien tableau vide. */
  useEffect(() => {
    setLines(deliveryNote.lines as EditableLine[]);
  }, [deliveryNote.lines]);

  const [newLabel, setNewLabel] = useState("");
  const [newInventoryItemId, setNewInventoryItemId] = useState<string>("");
  const [newQtyDelivered, setNewQtyDelivered] = useState("");
  const [newQtyReceived, setNewQtyReceived] = useState("");
  const [newUnit, setNewUnit] = useState("");
  const [newBlLineTotal, setNewBlLineTotal] = useState("");
  const [newBlUnitPrice, setNewBlUnitPrice] = useState("");
  const [newReceivedTemp, setNewReceivedTemp] = useState("");
  const [newLotNumber, setNewLotNumber] = useState("");
  const [newExpiryDate, setNewExpiryDate] = useState("");
  const photoInputRef = useRef<HTMLInputElement>(null);
  const photoTargetLineRef = useRef<string | null>(null);
  const [uploadingPhotoLineId, setUploadingPhotoLineId] = useState<string | null>(null);
  const [deletingPhotoId, setDeletingPhotoId] = useState<string | null>(null);
  const [tracePhotoError, setTracePhotoError] = useState<string | null>(null);
  const [togglingVerifiedLineId, setTogglingVerifiedLineId] = useState<string | null>(null);

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

  function onChangeReceivedTemperature(id: string, value: string) {
    setLines((prev) =>
      prev.map((l): EditableLine =>
        l.id === id ? { ...l, received_temperature_celsius: value } : l
      )
    );
  }

  function onChangeLotNumber(id: string, value: string) {
    setLines((prev) =>
      prev.map((l): EditableLine => (l.id === id ? { ...l, lot_number: value } : l))
    );
  }

  function onChangeExpiryDate(id: string, value: string) {
    setLines((prev) =>
      prev.map((l): EditableLine => (l.id === id ? { ...l, expiry_date: value } : l))
    );
  }

  function openPhotoDialog(lineId: string) {
    photoTargetLineRef.current = lineId;
    photoInputRef.current?.click();
  }

  async function onTraceabilityPhotoSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const lineId = photoTargetLineRef.current;
    photoTargetLineRef.current = null;
    e.target.value = "";
    if (!file || !lineId) return;
    setTracePhotoError(null);
    setUploadingPhotoLineId(lineId);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${deliveryNote.restaurant_id}/traceability/${lineId}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from(DELIVERY_NOTES_BUCKET).upload(path, file, {
        cacheControl: "3600",
        upsert: false,
      });
      if (uploadErr) {
        setTracePhotoError(uploadErr.message);
        return;
      }
      await recordTraceabilityPhotoAction(
        deliveryNote.restaurant_id,
        deliveryNote.id,
        lineId,
        path
      );
      router.refresh();
    } catch (e: unknown) {
      setTracePhotoError(e instanceof Error ? e.message : "Enregistrement impossible.");
    } finally {
      setUploadingPhotoLineId(null);
    }
  }

  async function handleToggleLineVerified(lineId: string, verified: boolean) {
    setTogglingVerifiedLineId(lineId);
    try {
      await toggleDeliveryNoteLineVerifiedAction(
        deliveryNote.id,
        deliveryNote.restaurant_id,
        lineId,
        verified
      );
      router.refresh();
    } catch {
      /* ignore */
    } finally {
      setTogglingVerifiedLineId(null);
    }
  }

  async function handleDeletePhoto(photoId: string) {
    if (!confirm("Supprimer cette photo du registre ?")) return;
    setDeletingPhotoId(photoId);
    try {
      await deleteTraceabilityPhotoAction(
        deliveryNote.restaurant_id,
        deliveryNote.id,
        photoId
      );
      router.refresh();
    } catch {
      /* ignore */
    } finally {
      setDeletingPhotoId(null);
    }
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
          received_temperature_celsius: parseOptionalTemperature(l.received_temperature_celsius),
          lot_number:
            l.lot_number == null || String(l.lot_number).trim() === ""
              ? null
              : String(l.lot_number).trim(),
          expiry_date:
            l.expiry_date == null || String(l.expiry_date).trim() === ""
              ? null
              : String(l.expiry_date).trim().slice(0, 10),
        }))
      )
        .then(() => router.refresh())
        .catch(() => {});
    });
  }

  async function handleInventoryChange(lineId: string, value: string) {
    setPendingInventoryLineId(lineId);
    try {
      await setDeliveryNoteLineInventoryItemAction(
        deliveryNote.id,
        deliveryNote.restaurant_id,
        lineId,
        value === "" ? null : value
      );
      router.refresh();
    } catch {
      /* erreur silencieuse : l’état serveur reste cohérent après refresh */
    } finally {
      setPendingInventoryLineId(null);
    }
  }

  async function handleSaveLabelAlias(lineId: string, label: string, inventoryItemId: string) {
    setSavingAliasLineId(lineId);
    try {
      await saveDeliveryLabelAliasAction(
        deliveryNote.id,
        deliveryNote.restaurant_id,
        label,
        inventoryItemId
      );
      router.refresh();
    } finally {
      setSavingAliasLineId(null);
    }
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
    setNewReceivedTemp("");
    setNewLotNumber("");
    setNewExpiryDate("");
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
        manual_unit_price_stock_ht: null,
        supplier_invoice_extracted_line_id: null,
        received_temperature_celsius: parseOptionalTemperature(newReceivedTemp),
        lot_number: newLotNumber.trim() || null,
        expiry_date: newExpiryDate.trim() ? newExpiryDate.trim().slice(0, 10) : null,
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
        {!readOnly && (
          <p className="border-b border-slate-100 bg-slate-50/80 px-3 py-2 text-xs text-slate-600">
            <strong className="font-medium text-slate-700">Traçabilité</strong> : cochez chaque ligne une fois le
            produit vérifié physiquement ; température (°C), n° de lot et DLC ; photos en fin de ligne (le type au
            registre suit le composant stock lié). Optionnel sauf exigence hygiène.
          </p>
        )}
        <input
          ref={photoInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          aria-hidden
          onChange={onTraceabilityPhotoSelected}
        />
        {tracePhotoError && (
          <p className="border-b border-rose-100 bg-rose-50/90 px-3 py-2 text-xs text-rose-800" role="alert">
            {tracePhotoError}
          </p>
        )}
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
            <table className="w-full border-collapse text-sm [&_td]:align-top">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th
                    className="pb-2 pr-2 w-12 text-center"
                    title="Contrôle physique effectué"
                  >
                    OK
                  </th>
                  <th className="pb-2 pr-2">Produit / libellé</th>
                  <th className="pb-2 pr-2 text-right">Qté commandée (achat)</th>
                  <th className="pb-2 pr-2 text-right">Qté livrée (achat)</th>
                  <th className="pb-2 pr-2 text-right">Qté reçue (stock)</th>
                  <th className="pb-2 pr-2">Unité achat</th>
                  <th className="pb-2 pr-2">Unité stock</th>
                  <th
                    className="pb-2 pr-2 text-right min-w-[4.5rem]"
                    title="Température à la réception (°C), suivi hygiène"
                  >
                    Temp. °C
                  </th>
                  <th className="pb-2 pr-2 min-w-[6rem]" title="Numéro de lot fournisseur">
                    N° lot
                  </th>
                  <th className="pb-2 pr-2 min-w-[9rem]" title="Date limite de consommation / péremption">
                    DLC
                  </th>
                  <th className="pb-2 pr-2 text-right" title="Total HT de la ligne sur le BL">
                    Total ligne HT (€)
                  </th>
                  <th className="pb-2 pr-2 text-right" title="Prix unitaire HT en unité de stock (priorité si pas de total)">
                    Prix u. stock HT (€)
                  </th>
                  <th className="pb-2 pr-2 text-right">Écart (stock)</th>
                  <th className="pb-2 pr-2 min-w-[8rem]" title="Photos traçabilité (registre)">
                    Photo
                  </th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => {
                  const diff = computeDiffStock(line);
                  const qtyDeliveredDisplay = getQty(line, "qty_delivered");
                  const qtyReceivedDisplay = getQty(line, "qty_received");
                  const noProduct = !line.inventory_item_id;
                  const { suggested, rest } = buildInventorySelectOptions(
                    line.label,
                    inventoryItems,
                    deliveryLabelAliasMap
                  );
                  const memoized = lineHasSavedAlias(
                    line.label,
                    line.inventory_item_id,
                    deliveryLabelAliasMap
                  );
                  const rowVerified = Boolean(line.reception_line_verified_at);
                  return (
                    <tr
                      key={line.id}
                      className={`border-b transition-colors ${
                        rowVerified
                          ? "border-emerald-100 bg-emerald-50/90 hover:bg-emerald-50"
                          : "border-slate-100 bg-white hover:bg-slate-50/80"
                      }`}
                    >
                      <td className="py-2 pr-2 text-center">
                        {readOnly ? (
                          rowVerified ? (
                            <span
                              className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-emerald-200 text-emerald-800"
                              title="Ligne contrôlée"
                            >
                              <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden />
                            </span>
                          ) : (
                            <span
                              className="inline-flex h-9 min-h-9 w-9 items-center justify-center text-slate-300"
                              title="Non contrôlée"
                            >
                              —
                            </span>
                          )
                        ) : (
                          <button
                            type="button"
                            disabled={togglingVerifiedLineId === line.id}
                            onClick={() =>
                              void handleToggleLineVerified(line.id, !rowVerified)
                            }
                            title={
                              rowVerified
                                ? "Annuler la validation du contrôle"
                                : "Marquer comme contrôlé sur place"
                            }
                            className={`inline-flex h-9 w-9 items-center justify-center rounded-full border-2 transition-colors ${
                              rowVerified
                                ? "border-emerald-600 bg-emerald-600 text-white shadow-sm hover:bg-emerald-700"
                                : "border-slate-300 bg-white text-slate-400 hover:border-emerald-500 hover:text-emerald-600"
                            } disabled:opacity-50`}
                            aria-pressed={rowVerified}
                            aria-label={
                              rowVerified ? "Annuler la validation du contrôle" : "Valider le contrôle de la ligne"
                            }
                          >
                            {togglingVerifiedLineId === line.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                            ) : (
                              <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden />
                            )}
                          </button>
                        )}
                      </td>
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
                        {!readOnly && (
                          <div className="mt-2">
                            <label className="mb-0.5 block text-xs font-medium text-slate-500">
                              Produit stock
                            </label>
                            <select
                              className="box-border h-9 min-h-9 max-w-[min(100%,22rem)] rounded border border-slate-300 bg-white px-2 py-0 text-xs leading-none"
                              value={line.inventory_item_id ?? ""}
                              disabled={pendingInventoryLineId === line.id}
                              onChange={(e) => {
                                void handleInventoryChange(line.id, e.target.value);
                              }}
                            >
                              <option value="">— Aucun —</option>
                              {suggested.length > 0 && (
                                <optgroup label="Suggestions (libellé BL)">
                                  {suggested.map((c) => (
                                    <option key={c.id} value={c.id}>
                                      {c.name}
                                    </option>
                                  ))}
                                </optgroup>
                              )}
                              <optgroup label="Tous les articles">
                                {rest.map((item) => (
                                  <option key={item.id} value={item.id}>
                                    {item.name}
                                  </option>
                                ))}
                              </optgroup>
                            </select>
                            {line.inventory_item_id && line.label.trim() && !memoized && (
                              <button
                                type="button"
                                disabled={savingAliasLineId === line.id}
                                onClick={() =>
                                  void handleSaveLabelAlias(
                                    line.id,
                                    line.label,
                                    line.inventory_item_id as string
                                  )
                                }
                                className="mt-1.5 block text-left text-xs font-medium text-indigo-700 underline decoration-indigo-300 hover:text-indigo-900 disabled:opacity-50"
                              >
                                {savingAliasLineId === line.id
                                  ? "Enregistrement…"
                                  : "Mémoriser ce libellé BL → ce produit (prochains BL de ce fournisseur)"}
                              </button>
                            )}
                            {memoized && (
                              <p className="mt-1 text-xs text-slate-500">
                                Liaison mémorisée pour ce fournisseur.
                              </p>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="py-2 pr-2 text-right text-slate-600">
                        <span className="inline-flex h-9 min-h-9 items-center justify-end tabular-nums">
                          {Number(line.qty_ordered) || 0}
                        </span>
                      </td>
                      <td className="py-2 pr-2 text-right">
                        {readOnly ? (
                          <span className="inline-flex h-9 min-h-9 items-center justify-end text-slate-600 tabular-nums">
                            {qtyDeliveredDisplay}
                          </span>
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
                            className="box-border h-9 min-h-9 w-20 rounded border border-slate-300 px-2 py-0 text-right text-sm leading-none"
                          />
                        )}
                      </td>
                      <td className="py-2 pr-2 text-right">
                        {readOnly ? (
                          <span className="inline-flex h-9 min-h-9 items-center justify-end text-slate-600 tabular-nums">
                            {qtyReceivedDisplay}
                          </span>
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
                            className="box-border h-9 min-h-9 w-20 rounded border border-slate-300 px-2 py-0 text-right text-sm leading-none"
                          />
                        )}
                      </td>
                      <td className="py-2 pr-2 text-slate-600">
                        <span className="inline-flex h-9 min-h-9 items-center">{line.unit ?? "—"}</span>
                      </td>
                      <td className="py-2 pr-2 text-slate-600">
                        <span className="inline-flex h-9 min-h-9 items-center">{line.stock_unit ?? "—"}</span>
                      </td>
                      <td className="py-2 pr-2 text-right">
                        {readOnly ? (
                          <span
                            className="inline-flex h-9 min-h-9 items-center justify-end text-slate-600 tabular-nums"
                            title="Température à la réception"
                          >
                            {line.received_temperature_celsius != null &&
                            Number.isFinite(Number(line.received_temperature_celsius))
                              ? `${Number(line.received_temperature_celsius)} °C`
                              : "—"}
                          </span>
                        ) : (
                          <input
                            type="number"
                            inputMode="decimal"
                            step={0.1}
                            min={-60}
                            max={100}
                            placeholder="—"
                            value={temperatureInputValue(line)}
                            onChange={(e) =>
                              onChangeReceivedTemperature(line.id, e.target.value)
                            }
                            className="box-border h-9 min-h-9 w-[4.5rem] rounded border border-slate-300 px-2 py-0 text-right text-sm leading-none"
                          />
                        )}
                      </td>
                      <td className="py-2 pr-2">
                        {readOnly ? (
                          <span className="inline-flex h-9 min-h-9 items-center text-slate-600">
                            {lotInputValue(line) || "—"}
                          </span>
                        ) : (
                          <input
                            type="text"
                            placeholder="—"
                            value={lotInputValue(line)}
                            onChange={(e) => onChangeLotNumber(line.id, e.target.value)}
                            className="box-border h-9 min-h-9 w-full min-w-[5rem] max-w-[8rem] rounded border border-slate-300 px-2 py-0 text-sm leading-none"
                          />
                        )}
                      </td>
                      <td className="py-2 pr-2">
                        {readOnly ? (
                          <span className="inline-flex h-9 min-h-9 items-center text-slate-600">
                            {expiryInputValue(line)
                              ? new Date(expiryInputValue(line) + "T12:00:00").toLocaleDateString("fr-FR")
                              : "—"}
                          </span>
                        ) : (
                          <input
                            type="date"
                            value={expiryInputValue(line)}
                            onChange={(e) => onChangeExpiryDate(line.id, e.target.value)}
                            className="box-border h-9 min-h-9 w-full min-w-[9rem] rounded border border-slate-300 px-2 py-0 text-sm leading-none"
                          />
                        )}
                      </td>
                      <td className="py-2 pr-2 text-right">
                        {readOnly ? (
                          <span className="inline-flex h-9 min-h-9 items-center justify-end text-slate-600 tabular-nums">
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
                            className="box-border h-9 min-h-9 w-24 rounded border border-slate-300 px-2 py-0 text-right text-sm leading-none"
                          />
                        )}
                      </td>
                      <td className="py-2 pr-2 text-right">
                        {readOnly ? (
                          <span className="inline-flex h-9 min-h-9 items-center justify-end text-slate-600 tabular-nums">
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
                            className="box-border h-9 min-h-9 w-24 rounded border border-slate-300 px-2 py-0 text-right text-sm leading-none"
                          />
                        )}
                      </td>
                      <td className="py-2 pr-2 text-right">
                        <span
                          className={`inline-flex h-9 min-h-9 items-center justify-end tabular-nums text-xs ${
                            diff === 0 ? "text-emerald-600" : "text-amber-700"
                          }`}
                        >
                          {diff > 0 ? `+${diff}` : diff}
                        </span>
                      </td>
                      <td className="py-2 pr-2">
                        <div className="flex max-w-[11rem] flex-col gap-1.5">
                          {!readOnly && (
                            <button
                              type="button"
                              disabled={uploadingPhotoLineId === line.id}
                              onClick={() => openPhotoDialog(line.id)}
                              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-slate-400 bg-white text-slate-800 hover:bg-slate-50 disabled:opacity-50"
                              title="Prendre ou ajouter une photo"
                              aria-label="Prendre une photo"
                            >
                              {uploadingPhotoLineId === line.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                              ) : (
                                <Camera className="h-4 w-4" aria-hidden />
                              )}
                            </button>
                          )}
                          <div className="flex flex-wrap gap-1">
                            {(line.traceability_photos ?? []).map((ph) => (
                              <span key={ph.id} className="relative inline-block">
                                {ph.file_url ? (
                                  <a
                                    href={ph.file_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block h-12 w-12 overflow-hidden rounded border border-slate-200 bg-slate-100"
                                    title={`${traceabilityTypeLabel(ph.element_type)} · ${new Date(ph.created_at).toLocaleString("fr-FR")}`}
                                  >
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                      src={ph.file_url}
                                      alt=""
                                      className="h-full w-full object-cover"
                                    />
                                  </a>
                                ) : (
                                  <span className="flex h-12 w-12 items-center justify-center rounded border border-slate-200 bg-slate-100 text-[10px] text-slate-500">
                                    ?
                                  </span>
                                )}
                                {!readOnly && (
                                  <button
                                    type="button"
                                    title="Supprimer la photo"
                                    disabled={deletingPhotoId === ph.id}
                                    onClick={() => void handleDeletePhoto(ph.id)}
                                    className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-rose-600 text-[10px] font-bold text-white hover:bg-rose-700 disabled:opacity-50"
                                  >
                                    ×
                                  </button>
                                )}
                              </span>
                            ))}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!readOnly && (
              <div className="border-t border-slate-200 px-3 py-2">
                <p className="mb-2 text-xs text-slate-500">
                  Coût unitaire stock : priorité aux montants saisis sur le BL (total ligne et prix unitaire), puis
                  dernier achat connu si besoin.
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
                Température à la réception (°C)
              </label>
              <input
                type="number"
                inputMode="decimal"
                step={0.1}
                min={-60}
                max={100}
                value={newReceivedTemp}
                onChange={(e) => setNewReceivedTemp(e.target.value)}
                placeholder="optionnel"
                className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">
                N° de lot
              </label>
              <input
                type="text"
                value={newLotNumber}
                onChange={(e) => setNewLotNumber(e.target.value)}
                placeholder="optionnel"
                className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">
                DLC (péremption)
              </label>
              <input
                type="date"
                value={newExpiryDate}
                onChange={(e) => setNewExpiryDate(e.target.value)}
                className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
              />
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
