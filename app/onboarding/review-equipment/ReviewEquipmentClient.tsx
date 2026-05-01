"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  PENDING_ONBOARDING_EQUIPMENT_KEY,
  type PendingOnboardingEquipmentStored,
} from "@/lib/onboardingPendingMenuStorage";
import {
  HYGIENE_CATEGORY_LABEL_FR,
  HYGIENE_ELEMENT_CATEGORIES,
  HYGIENE_RECURRENCE_LABEL_FR,
  HYGIENE_RECURRENCE_TYPES,
  HYGIENE_RISK_LABEL_FR,
  HYGIENE_RISK_LEVELS,
  type HygieneElementCategory,
  type HygieneRecurrenceType,
  type HygieneRiskLevel,
} from "@/lib/hygiene/types";
import type { EquipmentAreaKind } from "@/lib/equipment-inventory-analysis";
import {
  uiBtnOutlineSm,
  uiBtnPrimaryBlock,
  uiBtnSecondary,
  uiCard,
  uiError,
  uiInput,
  uiMuted,
  uiSectionTitleSm,
  uiSelect,
  uiSuccess,
} from "@/components/ui/premium";
import { applyOnboardingEquipmentInventory } from "./actions";

const AREA_LABELS: Record<EquipmentAreaKind, string> = {
  kitchen: "Cuisine",
  dining: "Salle",
  bar: "Bar",
  storage: "Réserve",
  sanitary: "Sanitaires",
  other: "Autre",
};

type EditableEquipment = {
  clientId: string;
  selected: boolean;
  name: string;
  area_kind: EquipmentAreaKind;
  area_label: string;
  hygiene_category: HygieneElementCategory | null;
  quantity: number;
  create_hygiene_element: boolean;
  create_dining_table: boolean;
  notes: string;
  recurrence_type: HygieneRecurrenceType;
  risk_level: HygieneRiskLevel;
};

function newClientId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `equipment_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function parseStored(raw: string | null): EditableEquipment[] | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as PendingOnboardingEquipmentStored;
    if (data?.v !== 1 || !Array.isArray(data.items)) return null;
    return data.items
      .map((item): EditableEquipment | null => {
        const name = typeof item.name === "string" ? item.name.trim().replace(/\s+/g, " ") : "";
        if (!name) return null;
        const area = item.area_kind || "other";
        const riskLevel: HygieneRiskLevel =
          item.hygiene_category === "frigo" || item.hygiene_category === "congelateur" ? "important" : "standard";
        return {
          clientId: newClientId(),
          selected: true,
          name,
          area_kind: area,
          area_label: item.area_label?.trim() || AREA_LABELS[area],
          hygiene_category: item.hygiene_category ?? null,
          quantity: Number.isFinite(item.quantity) && item.quantity > 0 ? Math.round(item.quantity) : 1,
          create_hygiene_element: Boolean(item.create_hygiene_element && item.hygiene_category),
          create_dining_table: Boolean(item.create_dining_table),
          notes: item.notes?.trim() ?? "",
          recurrence_type: "daily",
          risk_level: riskLevel,
        };
      })
      .filter((row): row is EditableEquipment => Boolean(row));
  } catch {
    return null;
  }
}

export function ReviewEquipmentClient() {
  const router = useRouter();
  const initialRows = parseStored(
    typeof window !== "undefined" ? sessionStorage.getItem(PENDING_ONBOARDING_EQUIPMENT_KEY) : null
  );
  const [missing] = useState(() => initialRows == null);
  const [rows, setRows] = useState<EditableEquipment[]>(() => initialRows ?? []);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    inventoryCreated: number;
    hygieneCreated: number;
    tablesCreated: number;
    skipped: number;
    errors: string[];
  } | null>(null);

  function finish() {
    try {
      sessionStorage.removeItem(PENDING_ONBOARDING_EQUIPMENT_KEY);
    } catch {
      /* ignore */
    }
    router.push("/dashboard");
    router.refresh();
  }

  function updateRow(index: number, patch: Partial<EditableEquipment>) {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  async function applyRows() {
    const payload = rows.map((row) => ({
      selected: row.selected,
      name: row.name,
      area_kind: row.area_kind,
      area_label: row.area_label,
      hygiene_category: row.hygiene_category,
      quantity: row.quantity,
      create_hygiene_element: row.create_hygiene_element,
      create_dining_table: row.create_dining_table,
      notes: row.notes || null,
      recurrence_type: row.recurrence_type,
      risk_level: row.risk_level,
    }));
    setPending(true);
    setError(null);
    setResult(null);
    const res = await applyOnboardingEquipmentInventory(payload);
    setPending(false);
    if (!res.ok && res.inventoryCreated + res.hygieneCreated + res.tablesCreated === 0) {
      setError(res.errors.join(" ") || "Impossible de créer l’inventaire matériel.");
      return;
    }
    setResult(res);
    finish();
  }

  if (missing) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm text-slate-700">Aucun matériel à valider.</p>
        <button type="button" onClick={finish} className={uiBtnPrimaryBlock}>
          Ouvrir le tableau de bord
        </button>
      </div>
    );
  }

  const selectedCount = rows.filter((row) => row.selected && row.name.trim()).length;

  return (
    <div className="space-y-6">
      {error ? <div className={uiError}>{error}</div> : null}
      {result ? (
        <div className={uiSuccess}>
          {result.inventoryCreated} ligne(s) inventaire, {result.hygieneCreated} élément(s) hygiène,{" "}
          {result.tablesCreated} table(s) salle.
        </div>
      ) : null}

      <div>
        <h2 className={uiSectionTitleSm}>Matériel détecté ({rows.length})</h2>
        <p className={`mt-1 ${uiMuted}`}>
          Validez ce qui doit entrer dans l’inventaire. Cochez “Hygiène” pour préparer le PND, et “Table salle” pour
          alimenter directement le plan de salle.
        </p>
      </div>

      <div className="space-y-3">
        {rows.length === 0 ? (
          <div className={uiCard}>
            <p className={uiMuted}>Aucun élément détecté.</p>
          </div>
        ) : (
          rows.map((row, index) => (
            <div key={row.clientId} className={`${uiCard} space-y-3`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={row.selected}
                    onChange={(e) => updateRow(index, { selected: e.target.checked })}
                    className="h-4 w-4 rounded border-slate-300 accent-indigo-600"
                  />
                  Valider
                </label>
                <button type="button" onClick={() => removeRow(index)} className={uiBtnOutlineSm}>
                  Retirer
                </button>
              </div>

              <div className="grid gap-3 md:grid-cols-4">
                <label className="space-y-1 md:col-span-2">
                  <span className="block text-xs font-medium text-slate-500">Nom</span>
                  <input value={row.name} onChange={(e) => updateRow(index, { name: e.target.value })} className={`${uiInput} w-full`} />
                </label>
                <label className="space-y-1">
                  <span className="block text-xs font-medium text-slate-500">Zone</span>
                  <select
                    value={row.area_kind}
                    onChange={(e) =>
                      updateRow(index, {
                        area_kind: e.target.value as EquipmentAreaKind,
                        area_label: row.area_label || AREA_LABELS[e.target.value as EquipmentAreaKind],
                      })
                    }
                    className={`w-full ${uiSelect}`}
                  >
                    {Object.entries(AREA_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="block text-xs font-medium text-slate-500">Quantité</span>
                  <input
                    type="number"
                    min={1}
                    max={99}
                    value={row.quantity}
                    onChange={(e) => updateRow(index, { quantity: Number(e.target.value) })}
                    className={`${uiInput} w-full`}
                  />
                </label>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <label className="space-y-1">
                  <span className="block text-xs font-medium text-slate-500">Libellé zone</span>
                  <input
                    value={row.area_label}
                    onChange={(e) => updateRow(index, { area_label: e.target.value })}
                    className={`${uiInput} w-full`}
                    placeholder="ex. Cuisine chaude, terrasse"
                  />
                </label>
                <label className="space-y-1">
                  <span className="block text-xs font-medium text-slate-500">Catégorie hygiène</span>
                  <select
                    value={row.hygiene_category ?? ""}
                    onChange={(e) =>
                      updateRow(index, {
                        hygiene_category: e.target.value ? (e.target.value as HygieneElementCategory) : null,
                        create_hygiene_element: Boolean(e.target.value),
                      })
                    }
                    className={`w-full ${uiSelect}`}
                  >
                    <option value="">Pas d’élément hygiène</option>
                    {HYGIENE_ELEMENT_CATEGORIES.map((category) => (
                      <option key={category} value={category}>
                        {HYGIENE_CATEGORY_LABEL_FR[category]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="block text-xs font-medium text-slate-500">Fréquence PND</span>
                  <select
                    value={row.recurrence_type}
                    disabled={!row.create_hygiene_element}
                    onChange={(e) => updateRow(index, { recurrence_type: e.target.value as HygieneRecurrenceType })}
                    className={`w-full ${uiSelect}`}
                  >
                    {HYGIENE_RECURRENCE_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {HYGIENE_RECURRENCE_LABEL_FR[type]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={row.create_hygiene_element}
                    disabled={!row.hygiene_category}
                    onChange={(e) => updateRow(index, { create_hygiene_element: e.target.checked })}
                    className="h-4 w-4 rounded border-slate-300 accent-indigo-600"
                  />
                  Créer élément hygiène
                </label>
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={row.create_dining_table}
                    onChange={(e) => updateRow(index, { create_dining_table: e.target.checked })}
                    className="h-4 w-4 rounded border-slate-300 accent-indigo-600"
                  />
                  Créer table salle
                </label>
                <label className="space-y-1">
                  <span className="block text-xs font-medium text-slate-500">Risque hygiène</span>
                  <select
                    value={row.risk_level}
                    disabled={!row.create_hygiene_element}
                    onChange={(e) => updateRow(index, { risk_level: e.target.value as HygieneRiskLevel })}
                    className={`w-full ${uiSelect}`}
                  >
                    {HYGIENE_RISK_LEVELS.map((risk) => (
                      <option key={risk} value={risk}>
                        {HYGIENE_RISK_LABEL_FR[risk]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
          ))
        )}
      </div>

      <button type="button" onClick={() => void applyRows()} disabled={pending || selectedCount === 0} className={uiBtnPrimaryBlock}>
        {pending ? "Création de l’inventaire…" : `Valider ${selectedCount} élément(s) matériel`}
      </button>
      <button type="button" onClick={finish} className={uiBtnSecondary}>
        Passer le matériel pour l’instant
      </button>
    </div>
  );
}
