import { getMenuCategorySectionLabel } from "@/lib/public/menuCategories";
import {
  formulaIncludesDessert,
  getMenuFormulaLabel,
  getMenuFormulaSteps,
} from "@/lib/public/menuFormulas";
import type { MenuCategory } from "@/lib/public/menuCategories";
import type { PublicSetMenu } from "@/lib/public/types";

type Props = {
  menu: PublicSetMenu;
};

function renderStepBlock(menu: PublicSetMenu, step: MenuCategory, subtitle?: string) {
  const stepDishes = menu.dishes.filter((d) => d.step_category === step);
  if (stepDishes.length === 0) return null;

  return (
    <div key={`${menu.id}-${step}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-orange-800/80">
        {getMenuCategorySectionLabel(step)}
        {subtitle ? (
          <span className="ml-1.5 font-normal normal-case text-orange-700/90">({subtitle})</span>
        ) : null}
      </p>
      <ul className="mt-1 space-y-0.5">
        {stepDishes.map((dish) => (
          <li key={dish.id} className="text-sm text-slate-700">
            {dish.name}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SetMenuCard({ menu }: Props) {
  const formulaLabel = getMenuFormulaLabel(menu.formula_type);
  const steps = getMenuFormulaSteps(menu.formula_type);
  const hasDishes = menu.dishes.length > 0;
  const dessertSecondStep =
    formulaIncludesDessert(menu.formula_type) && menu.dessert_timing === "second_step";
  const firstSteps = dessertSecondStep ? steps.filter((step) => step !== "dessert") : steps;

  return (
    <article className="rounded-2xl border border-orange-200 bg-gradient-to-br from-orange-50 to-white p-5 shadow-sm transition hover:border-orange-300 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-lg font-bold text-slate-900">{menu.name}</h3>
          <p className="mt-0.5 text-sm font-medium text-orange-700">{formulaLabel}</p>
          {dessertSecondStep ? (
            <p className="mt-1 text-xs text-slate-500">Dessert choisi en fin de repas</p>
          ) : null}
        </div>
        <p className="shrink-0 text-xl font-black text-orange-600">
          {menu.price.toFixed(2).replace(".", ",")} €
        </p>
      </div>

      {hasDishes ? (
        <div className="mt-4 space-y-3">
          {firstSteps.map((step) => renderStepBlock(menu, step))}
          {dessertSecondStep ? (
            <>
              <div className="border-t border-orange-200/70 pt-3">
                {renderStepBlock(menu, "dessert", "2e temps")}
              </div>
            </>
          ) : null}
        </div>
      ) : (
        <p className="mt-4 text-sm text-slate-500">Au choix parmi la carte du jour.</p>
      )}

      {menu.description ? (
        <p className="mt-4 text-sm leading-relaxed text-slate-600">{menu.description}</p>
      ) : null}
    </article>
  );
}
