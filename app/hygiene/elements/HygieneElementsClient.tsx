"use client";

import { useMemo, useRef, useState, useTransition, useEffect } from "react";
import { Camera, Thermometer } from "lucide-react";
import { useRouter } from "next/navigation";
import type { HygieneElement, HygieneRecurrencePreset } from "@/lib/hygiene/types";
import {
  HYGIENE_CATEGORY_LABEL_FR,
  HYGIENE_ELEMENT_CATEGORIES,
  HYGIENE_RECURRENCE_LABEL_FR,
  HYGIENE_RECURRENCE_TYPES,
  HYGIENE_RISK_LABEL_FR,
  HYGIENE_RISK_LEVELS,
  HYGIENE_CLEANING_ACTION_TYPES,
  HYGIENE_CLEANING_ACTION_LABEL_FR,
} from "@/lib/hygiene/types";
import { supabase } from "@/lib/supabaseClient";
import { HYGIENE_PROOFS_BUCKET } from "@/lib/constants";
import {
  upsertHygieneElementAction,
  setHygieneElementActiveAction,
  deleteHygieneElementAction,
  createManualHygieneTaskAction,
  logHygieneElementDoneAction,
} from "../actions";
import { applyHygieneProtocolPreset, getHygieneProtocolPreset } from "@/lib/hygiene/protocolPresets";
import { HygieneProtocolPanel } from "@/components/hygiene/HygieneProtocolPanel";
import { uiBtnPrimarySm, uiBtnSecondary, uiCard, uiInput, uiLabel, uiSelect } from "@/components/ui/premium";

type Props = {
  restaurantId: string;
  elements: HygieneElement[];
  presets: HygieneRecurrencePreset[];
  initialElementId?: string | null;
};

const defaultCategory = "plan_travail" as (typeof HYGIENE_ELEMENT_CATEGORIES)[number];
const defaultPreset = getHygieneProtocolPreset(defaultCategory);

const COLD_CATEGORIES = new Set(["chambre_froide", "frigo", "congelateur"]);

const COLD_TEMP_DEFAULTS: Record<string, { min: number; max: number }> = {
  chambre_froide: { min: 0, max: 4 },
  frigo: { min: 0, max: 4 },
  congelateur: { min: -25, max: -15 },
};

const TEMP_RECURRENCE_LABEL_FR: Record<"daily" | "per_service", string> = {
  daily: "1 relevé / jour",
  per_service: "2 relevés / jour (ouverture & fermeture)",
};

const DAYS_OF_WEEK_FR = ["Dim.", "Lun.", "Mar.", "Mer.", "Jeu.", "Ven.", "Sam."];

const emptyForm = {
  id: null as string | null,
  name: "",
  category: defaultCategory,
  area_label: "",
  description: defaultPreset.description,
  risk_level: defaultPreset.suggested_risk_level as (typeof HYGIENE_RISK_LEVELS)[number],
  recurrence_type: "daily" as (typeof HYGIENE_RECURRENCE_TYPES)[number],
  recurrence_day_of_week: null as number | null,
  recurrence_day_of_month: null as number | null,
  cleaning_protocol: defaultPreset.cleaning_protocol,
  disinfection_protocol: defaultPreset.disinfection_protocol,
  product_used: defaultPreset.product_used,
  dosage: defaultPreset.dosage,
  contact_time: defaultPreset.contact_time,
  active: true,
  temp_point_enabled: false,
  temp_min_threshold: null as number | null,
  temp_max_threshold: null as number | null,
  temp_recurrence_type: "daily" as "daily" | "per_service",
  // Protocole secondaire (ex: nettoyage quotidien + désinfection hebdo)
  secondary_recurrence_type: null as (typeof HYGIENE_RECURRENCE_TYPES)[number] | null,
  secondary_recurrence_day_of_week: null as number | null,
  secondary_recurrence_day_of_month: null as number | null,
  secondary_cleaning_protocol: "",
  secondary_disinfection_protocol: "",
};

type FormState = typeof emptyForm;

export function HygieneElementsClient({ restaurantId, elements, presets, initialElementId }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [filter, setFilter] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  // null = aucune édition ouverte ; "new" = formulaire de création en haut ; id = édition inline
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [doneModalEl, setDoneModalEl] = useState<HygieneElement | null>(null);
  const [doneComment, setDoneComment] = useState("");
  const [doneFile, setDoneFile] = useState<File | null>(null);
  const [doneCleaningType, setDoneCleaningType] =
    useState<(typeof HYGIENE_CLEANING_ACTION_TYPES)[number]>("cleaning");
  const [doneInitials, setDoneInitials] = useState("");
  const [doneError, setDoneError] = useState<string | null>(null);
  const donePhotoInputRef = useRef<HTMLInputElement>(null);

  const presetByCategory = useMemo(() => {
    const m = new Map<string, HygieneRecurrencePreset>();
    for (const p of presets) m.set(p.category, p);
    return m;
  }, [presets]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return elements;
    return elements.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.area_label.toLowerCase().includes(q) ||
        HYGIENE_CATEGORY_LABEL_FR[e.category as keyof typeof HYGIENE_CATEGORY_LABEL_FR]
          ?.toLowerCase()
          .includes(q)
    );
  }, [elements, filter]);

  function applyPresetForCategory(cat: string, includeProtocol: boolean) {
    const p = presetByCategory.get(cat);
    const coldDefaults = COLD_TEMP_DEFAULTS[cat];
    setForm((f) => {
      let next = {
        ...f,
        category: cat as typeof f.category,
        ...(p
          ? {
              recurrence_type: p.default_recurrence_type as typeof f.recurrence_type,
              recurrence_day_of_week: p.recurrence_day_of_week,
              recurrence_day_of_month: p.recurrence_day_of_month,
            }
          : {}),
        ...(coldDefaults && !f.temp_min_threshold && !f.temp_max_threshold
          ? { temp_min_threshold: coldDefaults.min, temp_max_threshold: coldDefaults.max }
          : {}),
      };
      if (includeProtocol) next = applyHygieneProtocolPreset(next);
      return next;
    });
  }

  function openEdit(el: HygieneElement) {
    setFormError(null);
    setDeleteConfirmId(null);
    setForm({
      id: el.id,
      name: el.name,
      category: el.category as typeof emptyForm.category,
      area_label: el.area_label,
      description: el.description ?? "",
      risk_level: el.risk_level,
      recurrence_type: el.recurrence_type,
      recurrence_day_of_week: el.recurrence_day_of_week,
      recurrence_day_of_month: el.recurrence_day_of_month,
      cleaning_protocol: el.cleaning_protocol,
      disinfection_protocol: el.disinfection_protocol,
      product_used: el.product_used ?? "",
      dosage: el.dosage ?? "",
      contact_time: el.contact_time ?? "",
      active: el.active,
      temp_point_enabled: el.temp_point_enabled,
      temp_min_threshold: el.temp_min_threshold,
      temp_max_threshold: el.temp_max_threshold,
      temp_recurrence_type: el.temp_recurrence_type ?? "daily",
      secondary_recurrence_type: el.secondary_recurrence_type,
      secondary_recurrence_day_of_week: el.secondary_recurrence_day_of_week,
      secondary_recurrence_day_of_month: el.secondary_recurrence_day_of_month,
      secondary_cleaning_protocol: el.secondary_cleaning_protocol,
      secondary_disinfection_protocol: el.secondary_disinfection_protocol,
    });
    setEditingId(el.id);
  }

  function openNew() {
    setFormError(null);
    setDeleteConfirmId(null);
    setForm(emptyForm);
    setEditingId("new");
  }

  function closeForm() {
    setEditingId(null);
    setForm(emptyForm);
    setFormError(null);
  }

  useEffect(() => {
    if (!initialElementId) return;
    const el = elements.find((e) => e.id === initialElementId);
    if (el) openEdit(el);
  }, [initialElementId, elements]);

  function submit() {
    setFormError(null);
    start(async () => {
      const r = await upsertHygieneElementAction(restaurantId, {
        id: form.id,
        name: form.name,
        category: form.category,
        area_label: form.area_label,
        description: form.description || null,
        risk_level: form.risk_level,
        recurrence_type: form.recurrence_type,
        recurrence_day_of_week: form.recurrence_type === "weekly" ? form.recurrence_day_of_week : null,
        recurrence_day_of_month: ["monthly", "quarterly", "annual"].includes(form.recurrence_type) ? form.recurrence_day_of_month : null,
        cleaning_protocol: form.cleaning_protocol,
        disinfection_protocol: form.disinfection_protocol,
        product_used: form.product_used || null,
        dosage: form.dosage || null,
        contact_time: form.contact_time || null,
        active: form.active,
        temp_point_enabled: form.temp_point_enabled,
        temp_min_threshold: form.temp_min_threshold,
        temp_max_threshold: form.temp_max_threshold,
        temp_recurrence_type: form.temp_recurrence_type,
        secondary_recurrence_type: form.secondary_recurrence_type || null,
        secondary_recurrence_day_of_week: form.secondary_recurrence_type === "weekly" ? form.secondary_recurrence_day_of_week : null,
        secondary_recurrence_day_of_month: form.secondary_recurrence_type && ["monthly", "quarterly", "annual"].includes(form.secondary_recurrence_type) ? form.secondary_recurrence_day_of_month : null,
        secondary_cleaning_protocol: form.secondary_cleaning_protocol,
        secondary_disinfection_protocol: form.secondary_disinfection_protocol,
      });
      if (!r.ok) { setFormError(r.error); return; }
      closeForm();
      router.refresh();
    });
  }

  function FormPanel({ isNew }: { isNew: boolean }) {
    return (
      <div className="mt-2 rounded-xl border border-copper-100 bg-copper-50/40 p-4 space-y-3">
        <h2 className="text-sm font-semibold text-stone-900">
          {isNew ? "Ajouter un élément" : "Modifier l'élément"}
        </h2>
        {formError && <p className="text-sm text-rose-700">{formError}</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={uiLabel}>Nom</label>
            <input
              className={`${uiInput} mt-1 w-full`}
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div>
            <label className={uiLabel}>Catégorie</label>
            <select
              className={`${uiSelect} mt-1 w-full`}
              value={form.category}
              onChange={(e) => applyPresetForCategory(e.target.value, isNew)}
            >
              {HYGIENE_ELEMENT_CATEGORIES.map((c) => (
                <option key={c} value={c}>{HYGIENE_CATEGORY_LABEL_FR[c]}</option>
              ))}
            </select>
            {presetByCategory.get(form.category) && (
              <p className="mt-1 text-xs text-stone-500">{presetByCategory.get(form.category)?.label_fr}</p>
            )}
          </div>
          <div>
            <label className={uiLabel}>Zone / emplacement</label>
            <input
              className={`${uiInput} mt-1 w-full`}
              value={form.area_label}
              onChange={(e) => setForm((f) => ({ ...f, area_label: e.target.value }))}
              placeholder="ex. Cuisine ligne 1"
            />
          </div>
          <div>
            <label className={uiLabel}>Criticité</label>
            <select
              className={`${uiSelect} mt-1 w-full`}
              value={form.risk_level}
              onChange={(e) => setForm((f) => ({ ...f, risk_level: e.target.value as FormState["risk_level"] }))}
            >
              {HYGIENE_RISK_LEVELS.map((r) => (
                <option key={r} value={r}>{HYGIENE_RISK_LABEL_FR[r]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={uiLabel}>Récurrence</label>
            <select
              className={`${uiSelect} mt-1 w-full`}
              value={form.recurrence_type}
              onChange={(e) => setForm((f) => ({ ...f, recurrence_type: e.target.value as FormState["recurrence_type"] }))}
            >
              {HYGIENE_RECURRENCE_TYPES.map((r) => (
                <option key={r} value={r}>{HYGIENE_RECURRENCE_LABEL_FR[r]}</option>
              ))}
            </select>
          </div>
          {form.recurrence_type === "weekly" && (
            <div>
              <label className={uiLabel}>Jour de la semaine</label>
              <select
                className={`${uiSelect} mt-1 w-full`}
                value={form.recurrence_day_of_week ?? 1}
                onChange={(e) => setForm((f) => ({ ...f, recurrence_day_of_week: Number(e.target.value) }))}
              >
                {DAYS_OF_WEEK_FR.map((label, dow) => (
                  <option key={dow} value={dow}>{label}</option>
                ))}
              </select>
            </div>
          )}
          {["monthly", "quarterly", "annual"].includes(form.recurrence_type) && (
            <div>
              <label className={uiLabel}>Jour du mois (1–28)</label>
              <input
                type="number" min={1} max={28}
                className={`${uiInput} mt-1 w-full`}
                value={form.recurrence_day_of_month ?? 1}
                onChange={(e) => setForm((f) => ({ ...f, recurrence_day_of_month: Number(e.target.value) }))}
              />
            </div>
          )}
          <div className="sm:col-span-2">
            <label className={uiLabel}>Description (optionnel)</label>
            <textarea
              className={`${uiInput} mt-1 min-h-[4rem] w-full`}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>
          <div className="sm:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className={uiLabel}>Protocole nettoyage</label>
              <button
                type="button"
                className="text-xs font-medium text-copper-700 hover:text-copper-600"
                onClick={() => setForm((f) => applyHygieneProtocolPreset(f))}
              >
                Appliquer le protocole type
              </button>
            </div>
            <textarea
              className={`${uiInput} mt-1 min-h-[6rem] w-full font-mono text-xs leading-relaxed`}
              value={form.cleaning_protocol}
              onChange={(e) => setForm((f) => ({ ...f, cleaning_protocol: e.target.value }))}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={uiLabel}>Protocole désinfection</label>
            <textarea
              className={`${uiInput} mt-1 min-h-[6rem] w-full font-mono text-xs leading-relaxed`}
              value={form.disinfection_protocol}
              onChange={(e) => setForm((f) => ({ ...f, disinfection_protocol: e.target.value }))}
            />
          </div>
          <div>
            <label className={uiLabel}>Produit (optionnel)</label>
            <input
              className={`${uiInput} mt-1 w-full`}
              value={form.product_used}
              onChange={(e) => setForm((f) => ({ ...f, product_used: e.target.value }))}
            />
          </div>
          <div>
            <label className={uiLabel}>Dosage (optionnel)</label>
            <input
              className={`${uiInput} mt-1 w-full`}
              value={form.dosage}
              onChange={(e) => setForm((f) => ({ ...f, dosage: e.target.value }))}
            />
          </div>
          <div>
            <label className={uiLabel}>Temps de contact (optionnel)</label>
            <input
              className={`${uiInput} mt-1 w-full`}
              value={form.contact_time}
              onChange={(e) => setForm((f) => ({ ...f, contact_time: e.target.value }))}
              placeholder="ex. 5 min"
            />
          </div>

          {/* ─── Protocole secondaire ───────────────────────────────────── */}
          <div className="sm:col-span-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-stone-800">Entretien secondaire (optionnel)</span>
              {form.secondary_recurrence_type ? (
                <button
                  type="button"
                  className="text-xs font-medium text-rose-600 hover:text-rose-500"
                  onClick={() => setForm((f) => ({ ...f, secondary_recurrence_type: null, secondary_cleaning_protocol: "", secondary_disinfection_protocol: "" }))}
                >
                  Supprimer
                </button>
              ) : (
                <button
                  type="button"
                  className="text-xs font-medium text-copper-700 hover:text-copper-600"
                  onClick={() => setForm((f) => ({ ...f, secondary_recurrence_type: "weekly" }))}
                >
                  + Ajouter un 2e protocole
                </button>
              )}
            </div>
            {form.secondary_recurrence_type && (
              <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50/50 p-3 space-y-3">
                <p className="text-xs text-amber-700">Ex : nettoyage quotidien + désinfection hebdomadaire profonde sur la même machine.</p>
                <div>
                  <label className={uiLabel}>Fréquence</label>
                  <select
                    className={`${uiSelect} mt-1 w-full`}
                    value={form.secondary_recurrence_type}
                    onChange={(e) => setForm((f) => ({ ...f, secondary_recurrence_type: e.target.value as typeof f.secondary_recurrence_type }))}
                  >
                    {HYGIENE_RECURRENCE_TYPES.filter((r) => r !== "after_each_service").map((r) => (
                      <option key={r} value={r}>{HYGIENE_RECURRENCE_LABEL_FR[r]}</option>
                    ))}
                  </select>
                </div>
                {form.secondary_recurrence_type === "weekly" && (
                  <div>
                    <label className={uiLabel}>Jour de la semaine</label>
                    <select
                      className={`${uiSelect} mt-1 w-full`}
                      value={form.secondary_recurrence_day_of_week ?? 1}
                      onChange={(e) => setForm((f) => ({ ...f, secondary_recurrence_day_of_week: Number(e.target.value) }))}
                    >
                      {DAYS_OF_WEEK_FR.map((label, dow) => (
                        <option key={dow} value={dow}>{label}</option>
                      ))}
                    </select>
                  </div>
                )}
                {form.secondary_recurrence_type && ["monthly", "quarterly", "annual"].includes(form.secondary_recurrence_type) && (
                  <div>
                    <label className={uiLabel}>Jour du mois (1–28)</label>
                    <input
                      type="number" min={1} max={28}
                      className={`${uiInput} mt-1 w-full`}
                      value={form.secondary_recurrence_day_of_month ?? 1}
                      onChange={(e) => setForm((f) => ({ ...f, secondary_recurrence_day_of_month: Number(e.target.value) }))}
                    />
                  </div>
                )}
                <div>
                  <label className={uiLabel}>Protocole nettoyage (2e entretien)</label>
                  <textarea
                    className={`${uiInput} mt-1 min-h-[5rem] w-full font-mono text-xs leading-relaxed`}
                    value={form.secondary_cleaning_protocol}
                    onChange={(e) => setForm((f) => ({ ...f, secondary_cleaning_protocol: e.target.value }))}
                    placeholder="Décrivez les étapes du 2e entretien…"
                  />
                </div>
                <div>
                  <label className={uiLabel}>Protocole désinfection (2e entretien)</label>
                  <textarea
                    className={`${uiInput} mt-1 min-h-[4rem] w-full font-mono text-xs leading-relaxed`}
                    value={form.secondary_disinfection_protocol}
                    onChange={(e) => setForm((f) => ({ ...f, secondary_disinfection_protocol: e.target.value }))}
                  />
                </div>
              </div>
            )}
          </div>

          {COLD_CATEGORIES.has(form.category) && (
            <div className="sm:col-span-2 rounded-xl border border-sky-200 bg-sky-50/60 p-3 space-y-3">
              <div className="flex items-center gap-2">
                <input
                  id="el-temp-enabled"
                  type="checkbox"
                  checked={form.temp_point_enabled}
                  onChange={(e) => {
                    const enabled = e.target.checked;
                    setForm((f) => {
                      const defaults = COLD_TEMP_DEFAULTS[f.category];
                      return {
                        ...f,
                        temp_point_enabled: enabled,
                        temp_min_threshold: enabled && f.temp_min_threshold == null ? (defaults?.min ?? null) : f.temp_min_threshold,
                        temp_max_threshold: enabled && f.temp_max_threshold == null ? (defaults?.max ?? null) : f.temp_max_threshold,
                      };
                    });
                  }}
                />
                <label htmlFor="el-temp-enabled" className="text-sm font-medium text-sky-900">
                  Point de mesure de température (relevé HACCP)
                </label>
              </div>
              {form.temp_point_enabled && (
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <label className={uiLabel} htmlFor="el-temp-min">Seuil min (°C)</label>
                    <input
                      id="el-temp-min" type="text" inputMode="decimal"
                      className={`${uiInput} mt-1 w-full tabular-nums`}
                      value={form.temp_min_threshold ?? ""}
                      onChange={(e) => setForm((f) => ({ ...f, temp_min_threshold: e.target.value === "" ? null : Number(e.target.value.replace(",", ".")) }))}
                      placeholder="ex. 0"
                    />
                  </div>
                  <div>
                    <label className={uiLabel} htmlFor="el-temp-max">Seuil max (°C)</label>
                    <input
                      id="el-temp-max" type="text" inputMode="decimal"
                      className={`${uiInput} mt-1 w-full tabular-nums`}
                      value={form.temp_max_threshold ?? ""}
                      onChange={(e) => setForm((f) => ({ ...f, temp_max_threshold: e.target.value === "" ? null : Number(e.target.value.replace(",", ".")) }))}
                      placeholder="ex. 4"
                    />
                  </div>
                  <div>
                    <label className={uiLabel} htmlFor="el-temp-recurrence">Fréquence</label>
                    <select
                      id="el-temp-recurrence"
                      className={`${uiSelect} mt-1 w-full`}
                      value={form.temp_recurrence_type}
                      onChange={(e) => setForm((f) => ({ ...f, temp_recurrence_type: e.target.value as "daily" | "per_service" }))}
                    >
                      {(["daily", "per_service"] as const).map((v) => (
                        <option key={v} value={v}>{TEMP_RECURRENCE_LABEL_FR[v]}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-2 sm:col-span-2">
            <input
              id="el-active" type="checkbox"
              checked={form.active}
              onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
            />
            <label htmlFor="el-active" className="text-sm text-stone-700">Actif</label>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={pending} onClick={submit} className={uiBtnPrimarySm}>
            {pending ? "Enregistrement…" : "Enregistrer"}
          </button>
          <button type="button" disabled={pending} onClick={closeForm} className={uiBtnSecondary}>
            Annuler
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          placeholder="Filtrer par nom, zone, catégorie…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className={`${uiInput} max-w-md flex-1`}
        />
        <button type="button" onClick={openNew} className={uiBtnPrimarySm}>
          Nouvel élément
        </button>
      </div>

      {/* Formulaire de création en haut */}
      {editingId === "new" && <FormPanel isNew />}

      <ul className="space-y-2">
        {filtered.map((el) => (
          <li key={el.id}>
            <div className={`${uiCard} flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between`}>
              <div>
                <p className="font-medium text-stone-900">{el.name}</p>
                <p className="text-xs text-stone-500">
                  {HYGIENE_CATEGORY_LABEL_FR[el.category as keyof typeof HYGIENE_CATEGORY_LABEL_FR] ?? el.category}{" "}
                  · {el.area_label || "—"} · {HYGIENE_RISK_LABEL_FR[el.risk_level]} ·{" "}
                  {HYGIENE_RECURRENCE_LABEL_FR[el.recurrence_type]}
                  {el.temp_point_enabled && (
                    <span className="ml-2 inline-flex items-center gap-0.5 text-sky-700">
                      <Thermometer className="h-3 w-3" aria-hidden />
                      {el.temp_min_threshold}–{el.temp_max_threshold} °C
                    </span>
                  )}
                  {!el.active && <span className="ml-2 text-amber-700">(inactif)</span>}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={uiBtnPrimarySm}
                  onClick={() => {
                    setDoneModalEl(el);
                    setDoneComment("");
                    setDoneFile(null);
                    setDoneCleaningType("cleaning");
                    setDoneInitials("");
                    setDoneError(null);
                  }}
                >
                  Marquer comme fait
                </button>
                {el.recurrence_type === "after_each_service" && el.active && (
                  <button
                    type="button"
                    className={uiBtnSecondary}
                    onClick={() => start(async () => {
                      await createManualHygieneTaskAction(restaurantId, el.id);
                      router.refresh();
                    })}
                  >
                    Tâche après service
                  </button>
                )}
                <button
                  type="button"
                  className={uiBtnSecondary}
                  onClick={() => editingId === el.id ? closeForm() : openEdit(el)}
                >
                  {editingId === el.id ? "Fermer" : "Modifier"}
                </button>
                <button
                  type="button"
                  className={uiBtnSecondary}
                  onClick={() => start(async () => {
                    await setHygieneElementActiveAction(restaurantId, el.id, !el.active);
                    router.refresh();
                  })}
                >
                  {el.active ? "Désactiver" : "Réactiver"}
                </button>
                {deleteConfirmId === el.id ? (
                  <span className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={pending}
                      className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                      onClick={() => start(async () => {
                        const r = await deleteHygieneElementAction(restaurantId, el.id);
                        if (!r.ok) { setDeleteConfirmId(null); return; }
                        router.refresh();
                      })}
                    >
                      Confirmer
                    </button>
                    <button
                      type="button"
                      className={uiBtnSecondary}
                      onClick={() => setDeleteConfirmId(null)}
                    >
                      Annuler
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    className="rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50"
                    onClick={() => { setDeleteConfirmId(el.id); closeForm(); }}
                  >
                    Supprimer
                  </button>
                )}
              </div>
            </div>

            {/* Formulaire d'édition inline sous l'élément */}
            {editingId === el.id && <FormPanel isNew={false} />}
          </li>
        ))}
      </ul>

      {filtered.length === 0 && <p className="text-sm text-stone-500">Aucun élément ne correspond au filtre.</p>}

      {doneModalEl && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className={`${uiCard} max-h-[90vh] w-full max-w-md overflow-y-auto shadow-xl`}>
            <h3 className="text-sm font-semibold text-stone-900">Marquer comme fait</h3>
            <p className="mt-1 text-sm text-stone-600">{doneModalEl.name}</p>
            <HygieneProtocolPanel
              description={doneModalEl.description}
              cleaningProtocol={doneModalEl.cleaning_protocol}
              disinfectionProtocol={doneModalEl.disinfection_protocol}
              productUsed={doneModalEl.product_used}
              dosage={doneModalEl.dosage}
              contactTime={doneModalEl.contact_time}
            />
            <p className="mt-1 text-xs text-stone-500">
              Enregistrement immédiat au registre avec votre nom et l'heure. La photo est facultative.
            </p>
            {doneError && <p className="mt-2 text-sm text-rose-700">{doneError}</p>}
            <div className="mt-3">
              <label className={uiLabel} htmlFor="hygiene-done-action-type">Type d'intervention</label>
              <select
                id="hygiene-done-action-type"
                className={`${uiSelect} mt-1 w-full`}
                value={doneCleaningType}
                onChange={(e) => setDoneCleaningType(e.target.value as (typeof HYGIENE_CLEANING_ACTION_TYPES)[number])}
              >
                {HYGIENE_CLEANING_ACTION_TYPES.map((k) => (
                  <option key={k} value={k}>{HYGIENE_CLEANING_ACTION_LABEL_FR[k]}</option>
                ))}
              </select>
            </div>
            <div className="mt-3">
              <label className={uiLabel} htmlFor="hygiene-done-initials">
                Initiales (personne ayant réalisé l'intervention)
              </label>
              <input
                id="hygiene-done-initials"
                type="text" autoComplete="off" maxLength={16}
                className={`${uiInput} mt-1 w-full`}
                value={doneInitials}
                onChange={(e) => setDoneInitials(e.target.value)}
                placeholder="ex. J.D."
              />
            </div>
            <div className="mt-3">
              <label className={uiLabel}>Commentaire (optionnel)</label>
              <textarea
                className={`${uiInput} mt-1 min-h-[4rem] w-full`}
                value={doneComment}
                onChange={(e) => setDoneComment(e.target.value)}
                placeholder="ex. Nettoyage complet après service"
              />
            </div>
            <div className="mt-3">
              <label className={uiLabel}>Photo de preuve (optionnel)</label>
              <input
                ref={donePhotoInputRef}
                type="file" accept="image/*" capture="environment"
                className="hidden" aria-hidden
                onChange={(e) => setDoneFile(e.target.files?.[0] ?? null)}
              />
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className={`${uiBtnSecondary} inline-flex items-center gap-2`}
                  onClick={() => donePhotoInputRef.current?.click()}
                >
                  <Camera className="h-4 w-4 shrink-0" aria-hidden />
                  Prendre une photo
                </button>
                {doneFile && (
                  <span className="text-xs text-stone-600">
                    {doneFile.name}
                    <button
                      type="button"
                      className="ml-2 text-rose-700 underline"
                      onClick={() => {
                        setDoneFile(null);
                        if (donePhotoInputRef.current) donePhotoInputRef.current.value = "";
                      }}
                    >
                      Retirer
                    </button>
                  </span>
                )}
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={pending}
                className={uiBtnPrimarySm}
                onClick={() => {
                  if (!doneModalEl) return;
                  setDoneError(null);
                  if (doneInitials.trim().length < 2) {
                    setDoneError("Indiquez au moins 2 caractères pour les initiales.");
                    return;
                  }
                  start(async () => {
                    let proofPath: string | null = null;
                    if (doneFile) {
                      const ext = doneFile.name.split(".").pop() || "jpg";
                      const path = `${restaurantId}/direct/${doneModalEl.id}/${crypto.randomUUID()}.${ext}`;
                      const { error: upErr } = await supabase.storage.from(HYGIENE_PROOFS_BUCKET).upload(path, doneFile, { cacheControl: "3600", upsert: false });
                      if (upErr) { setDoneError(upErr.message); return; }
                      proofPath = path;
                    }
                    const r = await logHygieneElementDoneAction(restaurantId, doneModalEl.id, {
                      comment: doneComment.trim() || null,
                      proofPhotoPath: proofPath,
                      cleaningActionType: doneCleaningType,
                      initials: doneInitials,
                    });
                    if (!r.ok) { setDoneError(r.error); return; }
                    setDoneModalEl(null);
                    setDoneComment("");
                    setDoneFile(null);
                    setDoneCleaningType("cleaning");
                    setDoneInitials("");
                    if (donePhotoInputRef.current) donePhotoInputRef.current.value = "";
                    router.refresh();
                  });
                }}
              >
                {pending ? "Enregistrement…" : "Enregistrer au registre"}
              </button>
              <button
                type="button"
                disabled={pending}
                className={uiBtnSecondary}
                onClick={() => {
                  setDoneModalEl(null);
                  setDoneComment("");
                  setDoneFile(null);
                  setDoneCleaningType("cleaning");
                  setDoneInitials("");
                  setDoneError(null);
                  if (donePhotoInputRef.current) donePhotoInputRef.current.value = "";
                }}
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
