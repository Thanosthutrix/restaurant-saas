"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { Camera } from "lucide-react";
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
  createManualHygieneTaskAction,
  logHygieneElementDoneAction,
} from "../actions";
import { uiBtnPrimarySm, uiBtnSecondary, uiCard, uiInput, uiLabel, uiSelect } from "@/components/ui/premium";

type Props = {
  restaurantId: string;
  elements: HygieneElement[];
  presets: HygieneRecurrencePreset[];
};

const emptyForm = {
  id: null as string | null,
  name: "",
  category: "plan_travail" as (typeof HYGIENE_ELEMENT_CATEGORIES)[number],
  area_label: "",
  description: "",
  risk_level: "standard" as (typeof HYGIENE_RISK_LEVELS)[number],
  recurrence_type: "daily" as (typeof HYGIENE_RECURRENCE_TYPES)[number],
  recurrence_day_of_week: null as number | null,
  recurrence_day_of_month: null as number | null,
  cleaning_protocol: "",
  disinfection_protocol: "",
  product_used: "",
  dosage: "",
  contact_time: "",
  active: true,
};

export function HygieneElementsClient({ restaurantId, elements, presets }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [filter, setFilter] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
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

  function applyPresetForCategory(cat: string) {
    const p = presetByCategory.get(cat);
    if (!p) return;
    setForm((f) => ({
      ...f,
      category: cat as typeof f.category,
      recurrence_type: p.default_recurrence_type as typeof f.recurrence_type,
      recurrence_day_of_week: p.recurrence_day_of_week,
      recurrence_day_of_month: p.recurrence_day_of_month,
    }));
  }

  function edit(el: HygieneElement) {
    setShowForm(true);
    setError(null);
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
    });
  }

  function submit() {
    setError(null);
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
        recurrence_day_of_month: form.recurrence_type === "monthly" ? form.recurrence_day_of_month : null,
        cleaning_protocol: form.cleaning_protocol,
        disinfection_protocol: form.disinfection_protocol,
        product_used: form.product_used || null,
        dosage: form.dosage || null,
        contact_time: form.contact_time || null,
        active: form.active,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setForm(emptyForm);
      setShowForm(false);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          placeholder="Filtrer par nom, zone, catégorie…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className={`${uiInput} max-w-md flex-1`}
        />
        <button
          type="button"
          onClick={() => {
            setForm(emptyForm);
            setError(null);
            setShowForm(true);
          }}
          className={uiBtnPrimarySm}
        >
          Nouvel élément
        </button>
      </div>

      {showForm && (
        <div className={`${uiCard} space-y-3`}>
          <h2 className="text-sm font-semibold text-slate-900">
            {form.id ? "Modifier l’élément" : "Ajouter un élément"}
          </h2>
          {error && <p className="text-sm text-rose-700">{error}</p>}
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
                onChange={(e) => {
                  const cat = e.target.value;
                  setForm((f) => ({ ...f, category: cat as typeof f.category }));
                  applyPresetForCategory(cat);
                }}
              >
                {HYGIENE_ELEMENT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {HYGIENE_CATEGORY_LABEL_FR[c]}
                  </option>
                ))}
              </select>
              {presetByCategory.get(form.category) && (
                <p className="mt-1 text-xs text-slate-500">{presetByCategory.get(form.category)?.label_fr}</p>
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
                onChange={(e) =>
                  setForm((f) => ({ ...f, risk_level: e.target.value as typeof f.risk_level }))
                }
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
                  setForm((f) => ({ ...f, recurrence_type: e.target.value as typeof f.recurrence_type }))
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
                <label className={uiLabel}>Jour (0 = dimanche … 6 = samedi)</label>
                <input
                  type="number"
                  min={0}
                  max={6}
                  className={`${uiInput} mt-1 w-full`}
                  value={form.recurrence_day_of_week ?? 1}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, recurrence_day_of_week: Number(e.target.value) }))
                  }
                />
              </div>
            )}
            {form.recurrence_type === "monthly" && (
              <div>
                <label className={uiLabel}>Jour du mois (1–28)</label>
                <input
                  type="number"
                  min={1}
                  max={28}
                  className={`${uiInput} mt-1 w-full`}
                  value={form.recurrence_day_of_month ?? 1}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, recurrence_day_of_month: Number(e.target.value) }))
                  }
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
              <label className={uiLabel}>Protocole nettoyage</label>
              <textarea
                className={`${uiInput} mt-1 min-h-[4rem] w-full`}
                value={form.cleaning_protocol}
                onChange={(e) => setForm((f) => ({ ...f, cleaning_protocol: e.target.value }))}
              />
            </div>
            <div className="sm:col-span-2">
              <label className={uiLabel}>Protocole désinfection</label>
              <textarea
                className={`${uiInput} mt-1 min-h-[4rem] w-full`}
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
            <div className="flex items-center gap-2 sm:col-span-2">
              <input
                id="el-active"
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
              />
              <label htmlFor="el-active" className="text-sm text-slate-700">
                Actif
              </label>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={pending} onClick={submit} className={uiBtnPrimarySm}>
              {pending ? "Enregistrement…" : "Enregistrer"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setShowForm(false);
                setForm(emptyForm);
                setError(null);
              }}
              className={uiBtnSecondary}
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      <ul className="space-y-2">
        {filtered.map((el) => (
          <li key={el.id} className={`${uiCard} flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between`}>
            <div>
              <p className="font-medium text-slate-900">{el.name}</p>
              <p className="text-xs text-slate-500">
                {HYGIENE_CATEGORY_LABEL_FR[el.category as keyof typeof HYGIENE_CATEGORY_LABEL_FR] ?? el.category}{" "}
                · {el.area_label || "—"} · {HYGIENE_RISK_LABEL_FR[el.risk_level]} ·{" "}
                {HYGIENE_RECURRENCE_LABEL_FR[el.recurrence_type]}
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
                  onClick={() =>
                    start(async () => {
                      await createManualHygieneTaskAction(restaurantId, el.id);
                      router.refresh();
                    })
                  }
                >
                  Tâche après service
                </button>
              )}
              <button type="button" className={uiBtnSecondary} onClick={() => edit(el)}>
                Modifier
              </button>
              <button
                type="button"
                className={uiBtnSecondary}
                onClick={() =>
                  start(async () => {
                    await setHygieneElementActiveAction(restaurantId, el.id, !el.active);
                    router.refresh();
                  })
                }
              >
                {el.active ? "Désactiver" : "Réactiver"}
              </button>
            </div>
          </li>
        ))}
      </ul>

      {filtered.length === 0 && <p className="text-sm text-slate-500">Aucun élément ne correspond au filtre.</p>}

      {doneModalEl && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className={`${uiCard} max-h-[90vh] w-full max-w-md overflow-y-auto shadow-xl`}>
            <h3 className="text-sm font-semibold text-slate-900">Marquer comme fait</h3>
            <p className="mt-1 text-sm text-slate-600">{doneModalEl.name}</p>
            <p className="mt-1 text-xs text-slate-500">
              Enregistrement immédiat au registre avec votre nom et l’heure. La photo est facultative.
            </p>
            {doneError && <p className="mt-2 text-sm text-rose-700">{doneError}</p>}
            <div className="mt-3">
              <label className={uiLabel} htmlFor="hygiene-done-action-type">
                Type d’intervention
              </label>
              <select
                id="hygiene-done-action-type"
                className={`${uiSelect} mt-1 w-full`}
                value={doneCleaningType}
                onChange={(e) =>
                  setDoneCleaningType(e.target.value as (typeof HYGIENE_CLEANING_ACTION_TYPES)[number])
                }
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
                Initiales (personne ayant réalisé l’intervention)
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
                  <span className="text-xs text-slate-600">
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
                      const { error: upErr } = await supabase.storage.from(HYGIENE_PROOFS_BUCKET).upload(path, doneFile, {
                        cacheControl: "3600",
                        upsert: false,
                      });
                      if (upErr) {
                        setDoneError(upErr.message);
                        return;
                      }
                      proofPath = path;
                    }
                    const r = await logHygieneElementDoneAction(restaurantId, doneModalEl.id, {
                      comment: doneComment.trim() || null,
                      proofPhotoPath: proofPath,
                      cleaningActionType: doneCleaningType,
                      initials: doneInitials,
                    });
                    if (!r.ok) {
                      setDoneError(r.error);
                      return;
                    }
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
