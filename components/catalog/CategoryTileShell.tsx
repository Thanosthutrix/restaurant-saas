"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";

import { CategoryPictogram } from "@/components/catalog/CategoryPictogram";

type Props = {
  tileKey: string;
  title: string;
  subtitle: string;
  panelId: string;
  /** 0 = racine ; indentation pour les sous-rubriques. */
  depth: number;
  children: React.ReactNode;
};

/**
 * Une tuile de rubrique repliable (utilisée seule ou imbriquée sous une autre tuile).
 */
export function CategoryTileShell({ tileKey, title, subtitle, panelId, depth, children }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className={
        depth > 0
          ? "mt-2 border-l-2 border-indigo-100/90 pl-3"
          : "overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm ring-1 ring-slate-100/90"
      }
    >
      <button
        type="button"
        id={`tile-${tileKey}`}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className={
          depth > 0
            ? "flex w-full items-center gap-3 rounded-xl border border-slate-200/70 bg-gradient-to-br from-slate-50/90 to-indigo-50/40 p-3 text-left shadow-sm ring-1 ring-slate-100/80 transition hover:border-indigo-200/80 active:scale-[0.995]"
            : "flex w-full items-center gap-3 bg-gradient-to-br from-white via-white to-indigo-50/35 p-4 text-left transition hover:to-indigo-50/55 active:scale-[0.995]"
        }
      >
        <span
          className={
            depth > 0
              ? "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 shadow-inner ring-1 ring-indigo-100/90 sm:h-9 sm:w-9"
              : "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 shadow-inner ring-1 ring-indigo-100/90 sm:h-10 sm:w-10"
          }
        >
          <CategoryPictogram title={title} depth={depth} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="truncate text-base font-semibold tracking-tight text-slate-900">{title}</span>
          <span className="text-xs font-medium text-slate-500">{subtitle}</span>
        </span>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 shadow-inner ring-1 ring-indigo-100/90 sm:h-10 sm:w-10">
          <ChevronDown
            className={`h-5 w-5 transition-transform duration-300 ease-out ${open ? "rotate-180" : ""}`}
            aria-hidden
          />
        </span>
      </button>
      <div
        id={panelId}
        role="region"
        aria-labelledby={`tile-${tileKey}`}
        className={`grid transition-[grid-template-rows] duration-300 ease-out ${
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="min-h-0 overflow-hidden">
          <div
            className={
              depth > 0
                ? "border-t border-slate-100/90 bg-white/50 px-1 pb-2 pt-2"
                : "border-t border-slate-100 bg-slate-50/40 px-3 pb-3 pt-2 sm:px-4"
            }
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
