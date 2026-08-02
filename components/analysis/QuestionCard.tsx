"use client";

import type { FeedbackResponseType, SelectedShiftQuestion } from "@/lib/analysis/types";
import { uiBtnOutlineSm, uiBtnPrimarySm } from "@/components/ui/premium";

export type QuestionAnswer = Record<string, unknown>;

type Props = {
  question: SelectedShiftQuestion;
  onAnswer: (payload: QuestionAnswer) => void;
  disabled?: boolean;
};

const PLATE_COMPONENT_LABELS: Record<string, string> = {
  viande: "Viande",
  garniture: "Garniture",
  sauce: "Sauce",
  accompagnement: "Accompagnement",
  autre: "Autre",
};

export function QuestionCard({ question, onAnswer, disabled }: Props) {
  const commonBtn =
    "rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm font-semibold text-stone-800 shadow-sm transition hover:border-copper-300 hover:bg-copper-50 active:scale-[0.98] disabled:opacity-50";

  switch (question.responseType as FeedbackResponseType) {
    case "yes_no":
      return (
        <div className="flex gap-3">
          <button type="button" disabled={disabled} className={`${commonBtn} flex-1`} onClick={() => onAnswer({ value: true })}>
            Oui
          </button>
          <button type="button" disabled={disabled} className={`${commonBtn} flex-1`} onClick={() => onAnswer({ value: false })}>
            Non
          </button>
        </div>
      );

    case "yes_no_then_dish_component":
      return <YesNoDishComponentQuestion question={question} onAnswer={onAnswer} disabled={disabled} commonBtn={commonBtn} />;

    case "dish_picker":
      return (
        <PickerGrid
          disabled={disabled}
          items={(question.pickerOptions?.dishes ?? []).map((d) => ({
            key: d.id,
            label: d.name,
            imageUrl: d.image_url,
          }))}
          onPick={(key) => onAnswer({ dish_id: key })}
        />
      );

    case "ingredient_family_picker":
      return (
        <PickerGrid
          disabled={disabled}
          items={(question.pickerOptions?.ingredientFamilies ?? []).map((f) => ({
            key: f.id,
            label: f.name,
          }))}
          onPick={(key) => onAnswer({ category_id: key })}
        />
      );

    case "equipment_picker":
      return (
        <PickerGrid
          disabled={disabled}
          items={(question.pickerOptions?.equipment ?? []).map((e) => ({
            key: e.value,
            label: e.label,
          }))}
          onPick={(key) => onAnswer({ equipment: key })}
        />
      );

    case "emoji_stress":
    case "emoji_rating":
      return (
        <div className="flex flex-wrap justify-center gap-3">
          {(question.pickerOptions?.emojiOptions ?? []).map((opt) => (
            <button
              key={String(opt.value)}
              type="button"
              disabled={disabled}
              className="flex min-w-[5.5rem] flex-col items-center gap-1 rounded-2xl border border-stone-200 bg-white px-3 py-3 shadow-sm transition hover:border-copper-300 hover:bg-copper-50 active:scale-95 disabled:opacity-50"
              onClick={() => onAnswer({ value: opt.value, emoji: opt.emoji })}
            >
              <span className="text-3xl" aria-hidden>
                {opt.emoji}
              </span>
              {"label" in opt && opt.label ? (
                <span className="text-xs font-medium text-stone-600">{opt.label}</span>
              ) : null}
            </button>
          ))}
        </div>
      );

    default:
      return (
        <button type="button" disabled={disabled} className={uiBtnPrimarySm} onClick={() => onAnswer({ skipped: true })}>
          Continuer
        </button>
      );
  }
}

function YesNoDishComponentQuestion({
  question,
  onAnswer,
  disabled,
  commonBtn,
}: Props & { commonBtn: string }) {
  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <button
          type="button"
          disabled={disabled}
          className={`${commonBtn} flex-1`}
          onClick={() => onAnswer({ value: false })}
        >
          Non
        </button>
        <button
          type="button"
          disabled={disabled}
          className={`${commonBtn} flex-1`}
          onClick={() => onAnswer({ value: true, follow_up: "pending" })}
        >
          Oui
        </button>
      </div>
      <FollowUpDishComponent question={question} onAnswer={onAnswer} disabled={disabled} commonBtn={commonBtn} />
    </div>
  );
}

function FollowUpDishComponent({
  question,
  onAnswer,
  disabled,
  commonBtn,
}: Props & { commonBtn: string }) {
  return (
    <div className="rounded-xl border border-dashed border-stone-200 bg-stone-50/80 p-3">
      <p className="mb-2 text-xs font-medium text-stone-500">Si oui — précisez (optionnel)</p>
      <PickerGrid
        disabled={disabled}
        compact
        items={(question.pickerOptions?.dishes ?? []).slice(0, 8).map((d) => ({
          key: d.id,
          label: d.name,
          imageUrl: d.image_url,
        }))}
        onPick={(dishId) => {
          const components =
            question.pickerOptions?.plateComponents ??
            (question.followUpConfig.components as string[] | undefined) ??
            [];
          if (components.length === 0) {
            onAnswer({ value: true, dish_id: dishId });
            return;
          }
          /* Composant par défaut : premier tap = plat, second = composant via sous-grille */
          onAnswer({ value: true, dish_id: dishId, component: components[0] });
        }}
      />
      <div className="mt-2 flex flex-wrap gap-2">
        {(
          question.pickerOptions?.plateComponents ??
          (question.followUpConfig.components as string[] | undefined) ??
          []
        ).map((c) => (
          <button
            key={c}
            type="button"
            disabled={disabled}
            className={uiBtnOutlineSm}
            onClick={() => onAnswer({ value: true, component: c })}
          >
            {PLATE_COMPONENT_LABELS[c] ?? c}
          </button>
        ))}
      </div>
    </div>
  );
}

function PickerGrid({
  items,
  onPick,
  disabled,
  compact,
}: {
  items: { key: string; label: string; imageUrl?: string | null }[];
  onPick: (key: string) => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  if (items.length === 0) {
    return <p className="text-center text-sm text-stone-500">Aucune option disponible.</p>;
  }

  return (
    <div className={`grid gap-2 ${compact ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3"}`}>
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          disabled={disabled}
          className="flex flex-col items-center gap-2 rounded-2xl border border-stone-200 bg-white p-2 text-center shadow-sm transition hover:border-copper-300 hover:bg-copper-50 active:scale-[0.98] disabled:opacity-50"
          onClick={() => onPick(item.key)}
        >
          {item.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.imageUrl} alt="" className="h-12 w-12 rounded-lg object-cover" />
          ) : (
            <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-stone-100 text-lg">🍽</span>
          )}
          <span className="line-clamp-2 text-xs font-semibold text-stone-800">{item.label}</span>
        </button>
      ))}
    </div>
  );
}
