"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import {
  Boxes,
  Camera,
  CheckCircle2,
  Cog,
  DoorOpen,
  Droplets,
  Fan,
  Flame,
  Pencil,
  Plus,
  Power,
  Snowflake,
  Sparkles,
  Thermometer,
  Trash2,
  Truck,
  Utensils,
  type LucideIcon,
} from "lucide-react";
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
import { Modal } from "@/components/ui/Modal";
import { RiskPill } from "../hygieneUi";
import { uiBtnPrimary, uiBtnSecondary, uiInput, uiLabel, uiSelect } from "@/components/ui/premium";

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

/** Icône + teinte par famille de catégorie (identité visuelle des tuiles). */
function categoryMeta(cat: string): { Icon: LucideIcon; tone: string; tile: string } {
  if (COLD_CATEGORIES.has(cat)) return { Icon: Snowflake, tone: "bg-sky-50 text-sky-700", tile: "tile-sky" };
  if (cat === "four" || cat === "piano_plaque") return { Icon: Flame, tone: "bg-amber-50 text-amber-700", tile: "tile-amber" };
  if (cat === "hotte") return { Icon: Fan, tone: "bg-amber-50 text-amber-700", tile: "tile-amber" };
  if (cat === "trancheuse" || cat === "machine") return { Icon: Cog, tone: "bg-violet-50 text-violet-700", tile: "tile-violet" };
  if (cat === "poubelle" || cat === "zone_dechets") return { Icon: Trash2, tone: "bg-stone-100 text-stone-700", tile: "tile-copper" };
  if (cat === "vehicule") return { Icon: Truck, tone: "bg-stone-100 text-stone-700", tile: "tile-copper" };
  if (cat === "plonge" || cat === "sanitaire") return { Icon: Droplets, tone: "bg-cyan-50 text-cyan-700", tile: "tile-cyan" };
  if (cat === "ustensile" || cat === "bac_gastronorme") return { Icon: Utensils, tone: "bg-emerald-50 text-emerald-700", tile: "tile-emerald" };
  if (cat === "etagere" || cat === "reserve") return { Icon: Boxes, tone: "bg-emerald-50 text-emerald-700", tile: "tile-emerald" };
  if (cat === "poignee_contact") return { Icon: DoorOpen, tone: "bg-cyan-50 text-cyan-700", tile: "tile-cyan" };
  return { Icon: Sparkles, tone: "bg-cyan-50 text-cyan-700", tile: "tile-cyan" };
}

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
  secondary_recurrence_type: null as (typeof HYGIENE_RECURRENCE_TYPES)[number] | null,
  secondary_recurrence_day_of_week: null as number | null,
  secondary_recurrence_day_of_month: null as number | null,
  secondary_cleaning_protocol: "",
  secondary_disinfection_protocol: "",
};

type FormState = typeof emptyForm;

/** Pré-remplit le formulaire à partir d'un élément existant (édition). */
function formFromElement(el: HygieneElement): FormState {
  return {
    id: el.id,
    name: el.name,
    category: el.category as FormState["category"],
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
  };
}

export function HygieneElementsClient({ restaurantId, elements, presets, initialElementId }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [filter, setFilter] = useState("");

  // Modales — la modale d'édition peut s'ouvrir d'emblée via ?elementId= (lien externe).
  const initialEditEl = initialElementId ? elements.find((e) => e.id === initialElementId) ?? null : null;
  const [formMode, setFormMode] = useState<"new" | "edit" | null>(initialEditEl ? "edit" : null);
  const [form, setForm] = useState<FormState>(initialEditEl ? formFromElement(initialEditEl) : emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [detailEl, setDetailEl] = useState<HygieneElement | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  // Modale « marquer comme fait »
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
    setForm(formFromElement(el));
    setDetailEl(null);
    setFormMode("edit");
  }

  function openNew() {
    setFormError(null);
    setForm(emptyForm);
    setFormMode("new");
  }

  function closeForm() {
    setFormMode(null);
    setForm(emptyForm);
    setFormError(null);
  }

  function openDone(el: HygieneElement) {
    setDetailEl(null);
    setDoneModalEl(el);
    setDoneComment("");
    setDoneFile(null);
    setDoneCleaningType("cleaning");
    setDoneInitials("");
    setDoneError(null);
  }

  function closeDone() {
    setDoneModalEl(null);
    setDoneComment("");
    setDoneFile(null);
    setDoneCleaningType("cleaning");
    setDoneInitials("");
    setDoneError(null);
    if (donePhotoInputRef.current) donePhotoInputRef.current.value = "";
  }

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
        recurrence_day_of_month: ["monthly", "quarterly", "annual"].includes(form.recurrence_type)
          ? form.recurrence_day_of_month
          : null,
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
        secondary_recurrence_day_of_week:
          form.secondary_recurrence_type === "weekly" ? form.secondary_recurrence_day_of_week : null,
        secondary_recurrence_day_of_month:
          form.secondary_recurrence_type && ["monthly", "quarterly", "annual"].includes(form.secondary_recurrence_type)
            ? form.secondary_recurrence_day_of_month
            : null,
        secondary_cleaning_protocol: form.secondary_cleaning_protocol,
        secondary_disinfection_protocol: form.secondary_disinfection_protocol,
      });
      if (!r.ok) {
        setFormError(r.error);
        return;
      }
      closeForm();
      router.refresh();
    });
  }

  function submitDone() {
    if (!doneModalEl) return;
    setDoneError(null);
    if (doneInitials.trim().length < 2) {
      setDoneError("Indiquez au moins 2 caractères pour les initiales.");
      return;
    }
    const el = doneModalEl;
    start(async () => {
      let proofPath: string | null = null;
      if (doneFile) {
        const ext = doneFile.name.split(".").pop() || "jpg";
        const path = `${restaurantId}/direct/${el.id}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from(HYGIENE_PROOFS_BUCKET)
          .upload(path, doneFile, { cacheControl: "3600", upsert: false });
        if (upErr) {
          setDoneError(upErr.message);
          return;
        }
        proofPath = path;
      }
      const r = await logHygieneElementDoneAction(restaurantId, el.id, {
        comment: doneComment.trim() || null,
        proofPhotoPath: proofPath,
        cleaningActionType: doneCleaningType,
        initials: doneInitials,
      });
      if (!r.ok) {
        setDoneError(r.error);
        return;
      }
      closeDone();
      router.refresh();
    });
  }

  const isNew = formMode === "new";

  return (
    <div className="space-y-4">
      {/* Barre d'outils */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          placeholder="Filtrer par nom, zone, catégorie…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className={`${uiInput} max-w-md flex-1`}
        />
        <button type="button" onClick={openNew} className={`${uiBtnPrimary} inline-flex items-center gap-1.5`}>
          <Plus className="h-4 w-4" aria-hidden />
          Nouvel élément
        </button>
      </div>

      {/* Tuiles */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50/60 px-6 py-10 text-center">
          <p className="text-base font-semibold text-stone-800">
            {elements.length === 0 ? "Aucun élément au plan" : "Aucun élément ne correspond au filtre"}
          </p>
          <p className="mx-auto mt-1 max-w-md text-sm text-stone-500">
            {elements.length === 0
              ? "Ajoutez vos surfaces et équipements à nettoyer : les tâches seront générées selon la récurrence choisie."
              : "Essayez un autre mot-clé."}
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((el) => {
            const meta = categoryMeta(el.category);
            const Icon = meta.Icon;
            return (
              <li key={el.id}>
                <button
                  type="button"
                  onClick={() => {
                    setDeleteConfirm(false);
                    setDetailEl(el);
                  }}
                  className={`group relative flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-2xl border border-stone-200/60 bg-white p-3 text-center shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-md ${meta.tile} ${
                    el.active ? "" : "opacity-60"
                  }`}
                >
                  <span className="absolute left-2 top-2 flex items-center gap-1">
                    <RiskPill level={el.risk_level} />
                    {el.temp_point_enabled ? (
                      <span
                        className="flex h-5 w-5 items-center justify-center rounded-md bg-sky-100 text-sky-600"
                        title="Point de mesure de température"
                      >
                        <Thermometer className="h-3 w-3" aria-hidden />
                      </span>
                    ) : null}
                  </span>
                  <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${meta.tone}`}>
                    <Icon className="h-6 w-6" aria-hidden />
                  </span>
                  <span className="line-clamp-2 text-[13px] font-semibold leading-tight tracking-tight text-stone-900">
                    {el.name}
                  </span>
                  <span className="line-clamp-1 text-[11px] text-stone-500">
                    {el.area_label || HYGIENE_CATEGORY_LABEL_FR[el.category as keyof typeof HYGIENE_CATEGORY_LABEL_FR]}
                  </span>
                  <span className="text-[11px] font-medium text-stone-400">
                    {HYGIENE_RECURRENCE_LABEL_FR[el.recurrence_type]}
                    {!el.active ? " · inactif" : ""}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* ═══ Modale détail / actions ═══ */}
      {detailEl ? (
        <Modal
          title={detailEl.name}
          subtitle={`${HYGIENE_CATEGORY_LABEL_FR[detailEl.category as keyof typeof HYGIENE_CATEGORY_LABEL_FR] ?? detailEl.category}${detailEl.area_label ? ` · ${detailEl.area_label}` : ""}`}
          icon={categoryMeta(detailEl.category).Icon}
          tone={categoryMeta(detailEl.category).tone}
          onClose={() => setDetailEl(null)}
          footer={
            <>
              <button
                type="button"
                className={`${uiBtnPrimary} inline-flex items-center gap-1.5`}
                onClick={() => openDone(detailEl)}
              >
                <CheckCircle2 className="h-4 w-4" aria-hidden />
                Marquer comme fait
              </button>
              <button
                type="button"
                className={`${uiBtnSecondary} inline-flex items-center gap-1.5`}
                onClick={() => openEdit(detailEl)}
              >
                <Pencil className="h-4 w-4" aria-hidden />
                Modifier
              </button>
              <button
                type="button"
                disabled={pending}
                className={`${uiBtnSecondary} inline-flex items-center gap-1.5`}
                onClick={() => {
                  const el = detailEl;
                  start(async () => {
                    await setHygieneElementActiveAction(restaurantId, el.id, !el.active);
                    setDetailEl(null);
                    router.refresh();
                  });
                }}
              >
                <Power className="h-4 w-4" aria-hidden />
                {detailEl.active ? "Désactiver" : "Réactiver"}
              </button>
              {detailEl.recurrence_type === "after_each_service" && detailEl.active ? (
                <button
                  type="button"
                  disabled={pending}
                  className={uiBtnSecondary}
                  onClick={() => {
                    const el = detailEl;
                    start(async () => {
                      await createManualHygieneTaskAction(restaurantId, el.id);
                      setDetailEl(null);
                      router.refresh();
                    });
                  }}
                >
                  Tâche après service
                </button>
              ) : null}
              <span className="ml-auto">
                {deleteConfirm ? (
                  <span className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={pending}
                      className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                      onClick={() => {
                        const el = detailEl;
                        start(async () => {
                          const r = await deleteHygieneElementAction(restaurantId, el.id);
                          setDeleteConfirm(false);
                          setDetailEl(null);
                          if (r.ok) router.refresh();
                        });
                      }}
                    >
                      Confirmer
                    </button>
                    <button type="button" className={uiBtnSecondary} onClick={() => setDeleteConfirm(false)}>
                      Annuler
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50"
                    onClick={() => setDeleteConfirm(true)}
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    Supprimer
                  </button>
                )}
              </span>
            </>
          }
        >
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <RiskPill level={detailEl.risk_level} />
              <span className="rounded-md bg-stone-100 px-2 py-0.5 font-medium text-stone-600">
                {HYGIENE_RECURRENCE_LABEL_FR[detailEl.recurrence_type]}
              </span>
              {detailEl.temp_point_enabled ? (
                <span className="inline-flex items-center gap-1 rounded-md bg-sky-50 px-2 py-0.5 font-medium text-sky-700">
                  <Thermometer className="h-3 w-3" aria-hidden />
                  {detailEl.temp_min_threshold}–{detailEl.temp_max_threshold} °C
                </span>
              ) : null}
              {!detailEl.active ? (
                <span className="rounded-md bg-amber-50 px-2 py-0.5 font-medium text-amber-700">Inactif</span>
              ) : null}
            </div>
            <HygieneProtocolPanel
              description={detailEl.description}
              cleaningProtocol={detailEl.cleaning_protocol}
              disinfectionProtocol={detailEl.disinfection_protocol}
              productUsed={detailEl.product_used}
              dosage={detailEl.dosage}
              contactTime={detailEl.contact_time}
            />
          </div>
        </Modal>
      ) : null}

      {/* ═══ Modale formulaire (création / édition) ═══ */}
      {formMode ? (
        <Modal
          title={isNew ? "Ajouter un élément" : "Modifier l'élément"}
          icon={isNew ? Plus : Pencil}
          size="lg"
          onClose={closeForm}
          footer={
            <>
              <button type="button" disabled={pending} onClick={submit} className={uiBtnPrimary}>
                {pending ? "Enregistrement…" : "Enregistrer"}
              </button>
              <button type="button" disabled={pending} onClick={closeForm} className={uiBtnSecondary}>
                Annuler
              </button>
              {formError ? <span className="text-sm text-rose-700">{formError}</span> : null}
            </>
          }
        >
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
                  <option key={c} value={c}>
                    {HYGIENE_CATEGORY_LABEL_FR[c]}
                  </option>
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
                  <option key={r} value={r}>
                    {HYGIENE_RISK_LABEL_FR[r]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={uiLabel}>Récurrence</label>
              <select
                className={`${uiSelect} mt-1 w-full`}
                value={form.recurrence_type}
                onChange={(e) =>
                  setForm((f) => ({ ...f, recurrence_type: e.target.value as FormState["recurrence_type"] }))
                }
              >
                {HYGIENE_RECURRENCE_TYPES.map((r) => (
                  <option key={r} value={r}>
                    {HYGIENE_RECURRENCE_LABEL_FR[r]}
                  </option>
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
                    <option key={dow} value={dow}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {["monthly", "quarterly", "annual"].includes(form.recurrence_type) && (
              <div>
                <label className={uiLabel}>Jour du mois (1–28)</label>
                <input
                  type="number"
                  min={1}
                  max={28}
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

            {/* Protocole secondaire */}
            <div className="sm:col-span-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-stone-800">Entretien secondaire (optionnel)</span>
                {form.secondary_recurrence_type ? (
                  <button
                    type="button"
                    className="text-xs font-medium text-rose-600 hover:text-rose-500"
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        secondary_recurrence_type: null,
                        secondary_cleaning_protocol: "",
                        secondary_disinfection_protocol: "",
                      }))
                    }
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
                <div className="mt-2 space-y-3 rounded-xl border border-amber-200 bg-amber-50/50 p-3">
                  <p className="text-xs text-amber-700">
                    Ex : nettoyage quotidien + désinfection hebdomadaire profonde sur la même machine.
                  </p>
                  <div>
                    <label className={uiLabel}>Fréquence</label>
                    <select
                      className={`${uiSelect} mt-1 w-full`}
                      value={form.secondary_recurrence_type}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          secondary_recurrence_type: e.target.value as typeof f.secondary_recurrence_type,
                        }))
                      }
                    >
                      {HYGIENE_RECURRENCE_TYPES.filter((r) => r !== "after_each_service").map((r) => (
                        <option key={r} value={r}>
                          {HYGIENE_RECURRENCE_LABEL_FR[r]}
                        </option>
                      ))}
                    </select>
                  </div>
                  {form.secondary_recurrence_type === "weekly" && (
                    <div>
                      <label className={uiLabel}>Jour de la semaine</label>
                      <select
                        className={`${uiSelect} mt-1 w-full`}
                        value={form.secondary_recurrence_day_of_week ?? 1}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, secondary_recurrence_day_of_week: Number(e.target.value) }))
                        }
                      >
                        {DAYS_OF_WEEK_FR.map((label, dow) => (
                          <option key={dow} value={dow}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  {form.secondary_recurrence_type &&
                    ["monthly", "quarterly", "annual"].includes(form.secondary_recurrence_type) && (
                      <div>
                        <label className={uiLabel}>Jour du mois (1–28)</label>
                        <input
                          type="number"
                          min={1}
                          max={28}
                          className={`${uiInput} mt-1 w-full`}
                          value={form.secondary_recurrence_day_of_month ?? 1}
                          onChange={(e) =>
                            setForm((f) => ({ ...f, secondary_recurrence_day_of_month: Number(e.target.value) }))
                          }
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
              <div className="space-y-3 rounded-xl border border-sky-200 bg-sky-50/60 p-3 sm:col-span-2">
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
                          temp_min_threshold:
                            enabled && f.temp_min_threshold == null ? defaults?.min ?? null : f.temp_min_threshold,
                          temp_max_threshold:
                            enabled && f.temp_max_threshold == null ? defaults?.max ?? null : f.temp_max_threshold,
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
                      <label className={uiLabel} htmlFor="el-temp-min">
                        Seuil min (°C)
                      </label>
                      <input
                        id="el-temp-min"
                        type="text"
                        inputMode="decimal"
                        className={`${uiInput} mt-1 w-full tabular-nums`}
                        value={form.temp_min_threshold ?? ""}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            temp_min_threshold: e.target.value === "" ? null : Number(e.target.value.replace(",", ".")),
                          }))
                        }
                        placeholder="ex. 0"
                      />
                    </div>
                    <div>
                      <label className={uiLabel} htmlFor="el-temp-max">
                        Seuil max (°C)
                      </label>
                      <input
                        id="el-temp-max"
                        type="text"
                        inputMode="decimal"
                        className={`${uiInput} mt-1 w-full tabular-nums`}
                        value={form.temp_max_threshold ?? ""}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            temp_max_threshold: e.target.value === "" ? null : Number(e.target.value.replace(",", ".")),
                          }))
                        }
                        placeholder="ex. 4"
                      />
                    </div>
                    <div>
                      <label className={uiLabel} htmlFor="el-temp-recurrence">
                        Fréquence
                      </label>
                      <select
                        id="el-temp-recurrence"
                        className={`${uiSelect} mt-1 w-full`}
                        value={form.temp_recurrence_type}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, temp_recurrence_type: e.target.value as "daily" | "per_service" }))
                        }
                      >
                        {(["daily", "per_service"] as const).map((v) => (
                          <option key={v} value={v}>
                            {TEMP_RECURRENCE_LABEL_FR[v]}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center gap-2 sm:col-span-2">
              <input
                id="el-active"
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
              />
              <label htmlFor="el-active" className="text-sm text-stone-700">
                Actif
              </label>
            </div>
          </div>
        </Modal>
      ) : null}

      {/* ═══ Modale « marquer comme fait » ═══ */}
      {doneModalEl ? (
        <Modal
          title="Marquer comme fait"
          subtitle={doneModalEl.name}
          icon={CheckCircle2}
          tone="bg-emerald-50 text-emerald-700"
          onClose={closeDone}
          footer={
            <>
              <button type="button" disabled={pending} className={uiBtnPrimary} onClick={submitDone}>
                {pending ? "Enregistrement…" : "Enregistrer au registre"}
              </button>
              <button type="button" disabled={pending} className={uiBtnSecondary} onClick={closeDone}>
                Annuler
              </button>
              {doneError ? <span className="text-sm text-rose-700">{doneError}</span> : null}
            </>
          }
        >
          <HygieneProtocolPanel
            description={doneModalEl.description}
            cleaningProtocol={doneModalEl.cleaning_protocol}
            disinfectionProtocol={doneModalEl.disinfection_protocol}
            productUsed={doneModalEl.product_used}
            dosage={doneModalEl.dosage}
            contactTime={doneModalEl.contact_time}
          />
          <p className="mt-2 text-xs text-stone-500">
            Enregistrement immédiat au registre avec votre nom et l&apos;heure. La photo est facultative.
          </p>
          <div className="mt-3">
            <label className={uiLabel} htmlFor="hygiene-done-action-type">
              Type d&apos;intervention
            </label>
            <select
              id="hygiene-done-action-type"
              className={`${uiSelect} mt-1 w-full`}
              value={doneCleaningType}
              onChange={(e) => setDoneCleaningType(e.target.value as (typeof HYGIENE_CLEANING_ACTION_TYPES)[number])}
            >
              {HYGIENE_CLEANING_ACTION_TYPES.map((k) => (
                <option key={k} value={k}>
                  {HYGIENE_CLEANING_ACTION_LABEL_FR[k]}
                </option>
              ))}
            </select>
          </div>
          <div className="mt-3">
            <label className={uiLabel} htmlFor="hygiene-done-initials">
              Initiales (personne ayant réalisé l&apos;intervention)
            </label>
            <input
              id="hygiene-done-initials"
              type="text"
              autoComplete="off"
              maxLength={16}
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
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              aria-hidden
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
        </Modal>
      ) : null}
    </div>
  );
}
