"use client";

import { Plus, X } from "lucide-react";
import { useState } from "react";
import type { FloorPlanLevel } from "@/lib/salle/floorPlanDocument";
import {
  formatOpenTableCount,
  formatPlacedTableCount,
} from "@/lib/salle/floorPlanDocument";
import { uiBtnOutlineSm, uiInput } from "@/components/ui/premium";

const PRESET_LABELS = ["Terrasse", "Étage 1", "Étage 2", "Sous-sol", "Bar"];

export type FloorPlanTabCountVariant = "placed" | "open";

type Props = {
  levels: FloorPlanLevel[];
  activeLevelId: string;
  onSelect: (levelId: string) => void;
  /** `placed` = tables sur le plan (éditeur) ; `open` = commandes en cours (salle). */
  countVariant?: FloorPlanTabCountVariant;
  /** Compteur par onglet (prioritaire). */
  tableCountByLevel?: Record<string, number>;
  /** Libellé personnalisé par onglet (prioritaire sur countVariant). */
  countLabelByLevel?: Record<string, string>;
  editable?: boolean;
  onAdd?: (label: string) => void;
  onRename?: (levelId: string, label: string) => void;
  onRemove?: (levelId: string) => void;
};

export function FloorPlanLevelTabs({
  levels,
  activeLevelId,
  onSelect,
  countVariant = "placed",
  tableCountByLevel,
  countLabelByLevel,
  editable = false,
  onAdd,
  onRename,
  onRemove,
}: Props) {
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  function submitAdd(label: string) {
    const trimmed = label.trim();
    if (!trimmed || !onAdd) return;
    onAdd(trimmed);
    setAdding(false);
    setNewLabel("");
  }

  function submitRename(levelId: string) {
    const trimmed = renameValue.trim();
    if (!trimmed || !onRename) return;
    onRename(levelId, trimmed);
    setRenamingId(null);
    setRenameValue("");
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {levels.map((level) => {
          const active = level.id === activeLevelId;
          const isRenaming = renamingId === level.id;
          const tableCount = tableCountByLevel?.[level.id] ?? 0;
          const countLabel =
            countLabelByLevel?.[level.id] ??
            (countVariant === "open"
              ? formatOpenTableCount(tableCount)
              : formatPlacedTableCount(tableCount));
          const showOpenHighlight = countVariant === "open" && tableCount > 0;

          if (isRenaming && editable) {
            return (
              <form
                key={level.id}
                className="flex items-center gap-1"
                onSubmit={(e) => {
                  e.preventDefault();
                  submitRename(level.id);
                }}
              >
                <input
                  autoFocus
                  className={`${uiInput} h-9 min-w-[8rem] py-1 text-sm`}
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={() => submitRename(level.id)}
                />
              </form>
            );
          }

          return (
            <div key={level.id} className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => onSelect(level.id)}
                onDoubleClick={() => {
                  if (!editable || !onRename) return;
                  setRenamingId(level.id);
                  setRenameValue(level.label);
                }}
                className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition ${
                  active
                    ? "copper-sheen bg-copper-700 text-white shadow-sm"
                    : "border border-stone-200 bg-white text-stone-700 shadow-sm hover:border-copper-200 hover:bg-stone-50"
                }`}
              >
                <span>{level.label}</span>
                <span
                  className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${
                    active
                      ? showOpenHighlight
                        ? "bg-white text-copper-700"
                        : "bg-white/20 text-white"
                      : showOpenHighlight
                        ? "bg-copper-100 text-copper-800"
                        : "bg-stone-100 text-stone-500"
                  }`}
                >
                  {countLabel}
                </span>
              </button>
              {editable && levels.length > 1 && onRemove ? (
                <button
                  type="button"
                  aria-label={`Supprimer ${level.label}`}
                  onClick={() => onRemove(level.id)}
                  className="rounded-lg p-1.5 text-stone-400 transition hover:bg-rose-50 hover:text-rose-700"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
          );
        })}

        {editable && onAdd ? (
          adding ? (
            <form
              className="flex items-center gap-1"
              onSubmit={(e) => {
                e.preventDefault();
                submitAdd(newLabel);
              }}
            >
              <input
                autoFocus
                className={`${uiInput} h-9 min-w-[9rem] py-1 text-sm`}
                placeholder="Nom de l'espace"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                onBlur={() => {
                  if (newLabel.trim()) submitAdd(newLabel);
                  else setAdding(false);
                }}
              />
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className={`inline-flex items-center gap-1.5 ${uiBtnOutlineSm} px-3 py-2`}
            >
              <Plus className="h-3.5 w-3.5" />
              Ajouter un espace
            </button>
          )
        ) : null}
      </div>

      {editable && onAdd && adding ? (
        <div className="flex flex-wrap gap-1.5">
          {PRESET_LABELS.map((label) => (
            <button
              key={label}
              type="button"
              onClick={() => submitAdd(label)}
              className="rounded-lg border border-stone-200 bg-stone-50 px-2.5 py-1 text-xs font-medium text-stone-600 transition hover:border-copper-200 hover:bg-copper-50 hover:text-copper-800"
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
