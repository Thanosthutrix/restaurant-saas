"use client";

import type { HygieneTaskWithElement } from "@/lib/hygiene/hygieneDb";
import { HYGIENE_CATEGORY_LABEL_FR } from "@/lib/hygiene/types";
import { hygieneCategoryMeta } from "@/lib/hygiene/hygieneCategoryMeta";
import { RiskPill, fmtWhen } from "@/app/hygiene/hygieneUi";

type Props = {
  tasks: HygieneTaskWithElement[];
  /** Si défini, les tuiles sont cliquables (validation). */
  onSelect?: (task: HygieneTaskWithElement) => void;
  nowMs?: number;
};

export function HygieneTaskTileGrid({ tasks, onSelect, nowMs = Date.now() }: Props) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {tasks.map((t) => {
        const meta = hygieneCategoryMeta(t.element_category);
        const Icon = meta.Icon;
        const when = fmtWhen(t.due_at, nowMs);
        const categoryLabel =
          HYGIENE_CATEGORY_LABEL_FR[t.element_category as keyof typeof HYGIENE_CATEGORY_LABEL_FR] ??
          t.element_category;
        const subtitle = t.area_label?.trim() || categoryLabel;
        const interactive = Boolean(onSelect);

        const tileClass = `group relative flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-2xl border border-stone-200/60 bg-white p-3 text-center shadow-sm transition duration-200 ${meta.tile} ${
          interactive ? "hover:-translate-y-1 hover:shadow-md" : "opacity-90"
        } ${when.overdue ? "ring-1 ring-rose-200/80" : ""}`;

        const content = (
          <>
            <span className="absolute left-2 top-2">
              <RiskPill level={t.risk_level} />
            </span>
            {t.risk_level === "critical" ? (
              <span className="absolute right-2 top-2 text-[10px] font-semibold text-rose-600">Photo</span>
            ) : null}
            <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${meta.tone}`}>
              <Icon className="h-6 w-6" aria-hidden />
            </span>
            <span className="line-clamp-2 text-[13px] font-semibold leading-tight tracking-tight text-stone-900">
              {t.element_name}
            </span>
            <span className="line-clamp-1 text-[11px] text-stone-500">{subtitle}</span>
            <span
              className={`line-clamp-1 text-[11px] font-medium ${when.overdue ? "text-rose-600" : "text-stone-400"}`}
            >
              {when.hint}
            </span>
          </>
        );

        return (
          <li key={t.id}>
            {interactive ? (
              <button type="button" onClick={() => onSelect!(t)} className={tileClass}>
                {content}
              </button>
            ) : (
              <div className={tileClass}>{content}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
