"use client";

import { useMemo, useState } from "react";
import { BookOpen, Pencil, Plus, Trash2 } from "lucide-react";
import {
  deletePublicSetMenuAction,
  savePublicSetMenuAction,
} from "@/app/dishes/actions";
import { getMenuCategorySectionLabel } from "@/lib/public/menuCategories";
import type { MenuCategory } from "@/lib/public/menuCategories";
import {
  formulaIncludesDessert,
  getMenuFormulaLabel,
  getMenuFormulaSteps,
  getSetMenuDessertTimingLabel,
  MENU_FORMULA_TYPES,
  SET_MENU_DESSERT_TIMINGS,
  type MenuFormulaType,
  type SetMenuDessertTiming,
} from "@/lib/public/menuFormulas";
import {
  buildDishIdsByStep,
  pruneDishIdsForFormula,
  type SetMenuDishIdsByStep,
} from "@/lib/public/setMenuDishes";
import type { PublicSetMenu, PublicSetMenuDish } from "@/lib/public/types";
import { uiCard, uiInput, uiLabel } from "@/components/ui/premium";

export type SetMenuDishOption = {
  id: string;
  name: string;
  menu_category: MenuCategory;
};

type Props = {
  restaurantId: string;
  initialMenus: PublicSetMenu[];
  dishOptions: SetMenuDishOption[];
};

type FormState = {
  id?: string;
  name: string;
  description: string;
  priceTtc: string;
  formulaType: MenuFormulaType;
  dessertTiming: SetMenuDessertTiming;
  isPublic: boolean;
  dishIdsByStep: SetMenuDishIdsByStep;
};

const EMPTY_FORM: FormState = {
  name: "",
  description: "",
  priceTtc: "",
  formulaType: "entree_plat_dessert",
  dessertTiming: "with_previous",
  isPublic: true,
  dishIdsByStep: {},
};

function menuToForm(menu: PublicSetMenu): FormState {
  return {
    id: menu.id,
    name: menu.name,
    description: menu.description,
    priceTtc: menu.price.toFixed(2).replace(".", ","),
    formulaType: menu.formula_type,
    dessertTiming: menu.dessert_timing,
    isPublic: menu.is_public,
    dishIdsByStep: buildDishIdsByStep(menu.dishes),
  };
}

function buildDishesFromSelection(
  dishIdsByStep: SetMenuDishIdsByStep,
  dishOptions: SetMenuDishOption[]
): PublicSetMenuDish[] {
  const byId = new Map(dishOptions.map((d) => [d.id, d]));
  const out: PublicSetMenuDish[] = [];
  for (const [step, ids] of Object.entries(dishIdsByStep) as [MenuCategory, string[]][]) {
    for (const id of ids ?? []) {
      const dish = byId.get(id);
      if (!dish) continue;
      out.push({ id: dish.id, name: dish.name, step_category: step });
    }
  }
  return out;
}

function formatDishSummary(menu: PublicSetMenu): string | null {
  const parts = getMenuFormulaSteps(menu.formula_type)
    .map((step) => {
      const names = menu.dishes.filter((d) => d.step_category === step).map((d) => d.name);
      if (!names.length) return null;
      return `${getMenuCategorySectionLabel(step)} : ${names.join(", ")}`;
    })
    .filter(Boolean);

  if (!parts.length) return null;

  const timingNote =
    formulaIncludesDessert(menu.formula_type) && menu.dessert_timing === "second_step"
      ? " · Dessert en 2e temps"
      : "";

  return parts.join(" · ") + timingNote;
}

function StepDishPicker({
  step,
  dishOptions,
  selectedIds,
  disabled,
  onChange,
}: {
  step: MenuCategory;
  dishOptions: SetMenuDishOption[];
  selectedIds: string[];
  disabled: boolean;
  onChange: (ids: string[]) => void;
}) {
  const candidates = dishOptions.filter((d) => d.menu_category === step);

  function toggle(dishId: string) {
    if (selectedIds.includes(dishId)) {
      onChange(selectedIds.filter((id) => id !== dishId));
      return;
    }
    onChange([...selectedIds, dishId]);
  }

  return (
    <div className="rounded-lg border border-stone-200 bg-white p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-stone-600">
        {getMenuCategorySectionLabel(step)}
      </p>
      {candidates.length === 0 ? (
        <p className="mt-2 text-xs text-stone-500">
          Aucun plat enregistré en {getMenuCategorySectionLabel(step).toLowerCase()}. Créez un plat et
          assignez-lui cette catégorie dans sa fiche.
        </p>
      ) : (
        <ul className="mt-2 max-h-40 space-y-1.5 overflow-y-auto">
          {candidates.map((dish) => (
            <li key={dish.id}>
              <label className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-0.5 text-sm text-stone-800 hover:bg-stone-50">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-stone-300 text-orange-600"
                  checked={selectedIds.includes(dish.id)}
                  disabled={disabled}
                  onChange={() => toggle(dish.id)}
                />
                <span className="truncate">{dish.name}</span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function PublicSetMenusSection({ restaurantId, initialMenus, dishOptions }: Props) {
  const [menus, setMenus] = useState(initialMenus);
  const [form, setForm] = useState<FormState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formulaSteps = useMemo(
    () => (form ? getMenuFormulaSteps(form.formulaType) : []),
    [form?.formulaType]
  );

  function openCreate() {
    setError(null);
    setForm({ ...EMPTY_FORM });
  }

  function openEdit(menu: PublicSetMenu) {
    setError(null);
    setForm(menuToForm(menu));
  }

  function cancelForm() {
    setForm(null);
    setError(null);
  }

  function updateDishIdsForStep(step: MenuCategory, ids: string[]) {
    if (!form) return;
    setForm({
      ...form,
      dishIdsByStep: { ...form.dishIdsByStep, [step]: ids },
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;

    setLoading(true);
    setError(null);

    const priceTtc = Number(form.priceTtc.replace(",", "."));
    const dishIdsByStep = pruneDishIdsForFormula(form.dishIdsByStep, form.formulaType);

    const result = await savePublicSetMenuAction({
      restaurantId,
      id: form.id,
      name: form.name,
      description: form.description,
      priceTtc,
      formulaType: form.formulaType,
      dessertTiming: form.dessertTiming,
      isPublic: form.isPublic,
      dishIdsByStep,
    });

    setLoading(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    const saved: PublicSetMenu = {
      id: result.id,
      restaurant_id: restaurantId,
      name: form.name.trim(),
      description: form.description.trim(),
      price: Math.round(priceTtc * 100) / 100,
      formula_type: form.formulaType,
      dessert_timing: form.dessertTiming,
      is_public: form.isPublic,
      sort_order: 0,
      dishes: buildDishesFromSelection(dishIdsByStep, dishOptions),
    };

    setMenus((prev) => {
      const without = prev.filter((m) => m.id !== saved.id);
      return [...without, saved].sort((a, b) => a.name.localeCompare(b.name, "fr"));
    });
    setForm(null);
  }

  async function handleDelete(menuId: string) {
    if (!window.confirm("Supprimer cette formule ?")) return;

    setLoading(true);
    setError(null);
    const result = await deletePublicSetMenuAction(restaurantId, menuId);
    setLoading(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setMenus((prev) => prev.filter((m) => m.id !== menuId));
    if (form?.id === menuId) setForm(null);
  }

  return (
    <section className={`${uiCard} mb-8 space-y-4`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-100 text-orange-700">
            <BookOpen className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <h2 className="text-base font-semibold text-stone-900">Formules menu</h2>
            <p className="mt-1 text-sm text-stone-500">
              Composez vos menus avec les plats déjà enregistrés — visibles sur la carte publique.
            </p>
          </div>
        </div>
        {!form ? (
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-orange-600 px-3 py-2 text-xs font-semibold text-white hover:bg-orange-700"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Ajouter
          </button>
        ) : null}
      </div>

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      {menus.length === 0 && !form ? (
        <p className="rounded-lg border border-dashed border-stone-200 bg-stone-50/60 px-4 py-6 text-center text-sm text-stone-500">
          Aucune formule pour le moment. Ajoutez un menu du jour, un déjeuner ou une formule soir.
        </p>
      ) : (
        <ul className="space-y-2">
          {menus.map((menu) => {
            const dishSummary = formatDishSummary(menu);
            return (
              <li
                key={menu.id}
                className="flex flex-col gap-3 rounded-lg border border-stone-100 bg-stone-50/50 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="font-medium text-stone-900">{menu.name}</p>
                  <p className="text-xs text-orange-700">{getMenuFormulaLabel(menu.formula_type)}</p>
                  {formulaIncludesDessert(menu.formula_type) && menu.dessert_timing === "second_step" ? (
                    <p className="text-xs text-stone-500">
                      {getSetMenuDessertTimingLabel(menu.dessert_timing)}
                    </p>
                  ) : null}
                  <p className="text-sm text-stone-600">
                    {menu.price.toFixed(2).replace(".", ",")} €
                    {!menu.is_public ? " · Masqué" : null}
                  </p>
                  {dishSummary ? (
                    <p className="mt-1 text-xs leading-relaxed text-stone-500">{dishSummary}</p>
                  ) : null}
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => openEdit(menu)}
                    className="inline-flex items-center gap-1 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50"
                  >
                    <Pencil className="h-3.5 w-3.5" aria-hidden />
                    Modifier
                  </button>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => void handleDelete(menu.id)}
                    className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    Supprimer
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {form ? (
        <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-stone-200 bg-stone-50/50 p-4">
          <p className="text-sm font-semibold text-stone-900">
            {form.id ? "Modifier la formule" : "Nouvelle formule"}
          </p>

          <div>
            <label htmlFor="setMenuName" className={uiLabel}>
              Nom
            </label>
            <input
              id="setMenuName"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Ex. Menu du jour, Formule déjeuner…"
              className={`${uiInput} mt-1 w-full`}
            />
          </div>

          <div>
            <label htmlFor="setMenuFormula" className={uiLabel}>
              Composition
            </label>
            <select
              id="setMenuFormula"
              value={form.formulaType}
              onChange={(e) => {
                const formulaType = e.target.value as MenuFormulaType;
                setForm({
                  ...form,
                  formulaType,
                  dishIdsByStep: pruneDishIdsForFormula(form.dishIdsByStep, formulaType),
                });
              }}
              className={`${uiInput} mt-1 w-full`}
            >
              {MENU_FORMULA_TYPES.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>

          {formulaIncludesDessert(form.formulaType) ? (
            <fieldset className="space-y-2">
              <legend className={uiLabel}>Choix du dessert</legend>
              <p className="text-xs text-stone-500">
                Indiquez si le client choisit le dessert en même temps que le reste, ou en fin de repas.
              </p>
              <div className="mt-1 space-y-2">
                {SET_MENU_DESSERT_TIMINGS.map((option) => (
                  <label
                    key={option.value}
                    className="flex cursor-pointer items-start gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-800 hover:border-orange-200"
                  >
                    <input
                      type="radio"
                      name="setMenuDessertTiming"
                      value={option.value}
                      checked={form.dessertTiming === option.value}
                      disabled={loading}
                      onChange={() => setForm({ ...form, dessertTiming: option.value })}
                      className="mt-0.5 h-4 w-4 border-stone-300 text-orange-600"
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}

          <div>
            <p className={uiLabel}>Plats de la formule</p>
            <p className="mt-0.5 text-xs text-stone-500">
              Cochez les plats proposés pour chaque étape. Seuls les plats dont la catégorie carte
              correspond apparaissent ici.
            </p>
            <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {formulaSteps.map((step) => (
                <StepDishPicker
                  key={step}
                  step={step}
                  dishOptions={dishOptions}
                  selectedIds={form.dishIdsByStep[step] ?? []}
                  disabled={loading}
                  onChange={(ids) => updateDishIdsForStep(step, ids)}
                />
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="setMenuPrice" className={uiLabel}>
              Prix TTC (€)
            </label>
            <input
              id="setMenuPrice"
              required
              inputMode="decimal"
              value={form.priceTtc}
              onChange={(e) => setForm({ ...form, priceTtc: e.target.value })}
              placeholder="28,00"
              className={`${uiInput} mt-1 w-full`}
            />
          </div>

          <div>
            <label htmlFor="setMenuDescription" className={uiLabel}>
              Description (optionnelle)
            </label>
            <textarea
              id="setMenuDescription"
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Ex. Au choix parmi les suggestions du chef…"
              className={`${uiInput} mt-1 w-full`}
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-stone-800">
            <input
              type="checkbox"
              checked={form.isPublic}
              onChange={(e) => setForm({ ...form, isPublic: e.target.checked })}
              className="h-4 w-4 rounded border-stone-300 text-orange-600"
            />
            Afficher sur la carte publique
          </label>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
            >
              {loading ? "Enregistrement…" : "Enregistrer"}
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={cancelForm}
              className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
            >
              Annuler
            </button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
