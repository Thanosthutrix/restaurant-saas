"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { updateDishCategory } from "./actions";
import { CategoryPictogram } from "@/components/catalog/CategoryPictogram";
import { leafSegmentFromCategoryPath } from "@/lib/catalog/restaurantCategories";
import { uiCard, uiLabel, uiLead, uiSelect } from "@/components/ui/premium";

type Opt = { id: string; label: string };

export function DishCategoryBlock({
  restaurantId,
  dishId,
  options,
  initialCategoryId,
  categoryPath,
}: {
  restaurantId: string;
  dishId: string;
  options: Opt[];
  initialCategoryId: string | null;
  categoryPath: string | null;
}) {
  const router = useRouter();
  const [value, setValue] = useState<string>(initialCategoryId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setValue(initialCategoryId ?? "");
  }, [initialCategoryId]);

  const pictoTitle =
    categoryPath == null
      ? "Sans rubrique"
      : leafSegmentFromCategoryPath(categoryPath) ?? categoryPath;

  const onChange = (next: string) => {
    const prev = value;
    setValue(next);
    const cat = next === "" ? null : next;
    setError(null);
    startTransition(async () => {
      const res = await updateDishCategory({
        restaurantId,
        dishId,
        categoryId: cat,
      });
      if (!res.ok) {
        setError(res.error);
        setValue(prev);
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className={uiCard}>
      <h2 className="mb-1 text-sm font-semibold text-slate-900">Rubrique carte</h2>
      <p className={`mb-3 text-xs ${uiLead}`}>
        Classez ce plat dans votre arborescence (ex. Entrées, Vins…).{" "}
        <Link href="/account#rubriques" className="font-semibold text-indigo-600 hover:text-indigo-500">
          Gérer les rubriques
        </Link>
      </p>
      <div className="mb-3 flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 shadow-inner ring-1 ring-indigo-100/90">
          <CategoryPictogram title={pictoTitle} depth={0} />
        </span>
        <div className="min-w-0 flex-1 pt-0.5">
          {categoryPath ? (
            <p className="text-sm text-slate-600">
              Actuellement : <span className="font-medium text-slate-900">{categoryPath}</span>
            </p>
          ) : (
            <p className="text-sm text-slate-500">Aucune rubrique assignée</p>
          )}
        </div>
      </div>
      {error ? (
        <p className="mb-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      ) : null}
      <label className="flex flex-col gap-1">
        <span className={uiLabel}>Rubrique</span>
        <select
          className={uiSelect}
          value={value}
          disabled={pending}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">— Sans rubrique —</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
