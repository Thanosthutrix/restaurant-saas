"use client";

import { useTransition } from "react";
import { Check } from "lucide-react";
import {
  fireDiningOrderBar,
  fireDiningOrderCourse,
  fireDiningOrderKitchenExtras,
} from "@/app/salle/actions";
import type { DiningLineClient } from "@/app/salle/commande/diningOrderTypes";
import {
  barLines,
  buildMealCourseSummaries,
  canFireBarLines,
  canFireKitchenExtraLines,
  isBarLinesFired,
  isBarLinesAllPrepared,
  isKitchenExtraLinesAllPrepared,
  isKitchenExtraLinesFired,
  kitchenExtraLines,
  type DiningCourseSummary,
} from "@/lib/dining/diningCourseLogic";
import type { OrderTicketSnapshot } from "@/lib/dining/orderTicketSnapshot";
import { uiBtnPrimarySm, uiLead } from "@/components/ui/premium";

type Props = {
  restaurantId: string;
  orderId: string;
  lines: DiningLineClient[];
  pending: boolean;
  onTicketApplied: (ticket: OrderTicketSnapshot) => void;
  onError: (message: string) => void;
};

function lineStatusLabel(line: DiningLineClient): string {
  if (line.isPrepared) return "Prêt";
  if (line.sentToKitchenAt) return line.isBarLine ? "Au bar" : "En cuisine";
  return "Brouillon";
}

function lineStatusClass(line: DiningLineClient): string {
  if (line.isPrepared) return "bg-emerald-100 text-emerald-800";
  if (line.sentToKitchenAt) return line.isBarLine ? "bg-violet-100 text-violet-900" : "bg-amber-100 text-amber-900";
  return "bg-stone-200 text-stone-700";
}

function LineDetail({ line }: { line: DiningLineClient }) {
  return (
    <div className="min-w-0 flex-1">
      <span className="font-medium text-stone-900">
        ×{line.qty} {line.dishName}
      </span>
      {line.kitchenLabels.length > 0 ? (
        <ul className="mt-0.5 space-y-0.5">
          {line.kitchenLabels.map((label) => (
            <li key={label} className="text-[10px] font-bold uppercase tracking-wide text-amber-900">
              {label}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function CourseBlock({
  summary,
  pending,
  onFire,
}: {
  summary: DiningCourseSummary;
  pending: boolean;
  onFire: (courseType: DiningCourseSummary["courseType"]) => void;
}) {
  return (
    <div className="rounded-xl border border-stone-200 bg-stone-50/80 p-2.5">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-wide text-stone-700">{summary.label}</p>
        {summary.allPrepared ? (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
            Service prêt — à servir
          </span>
        ) : summary.fired ? (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900">
            En cuisine
          </span>
        ) : summary.canFire ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => onFire(summary.courseType)}
            className={`inline-flex items-center gap-1.5 ${uiBtnPrimarySm}`}
          >
            <Check className="h-3.5 w-3.5" aria-hidden />
            Valider
          </button>
        ) : (
          <span className={`text-[10px] ${uiLead}`}>Terminez le service précédent</span>
        )}
      </div>
      <ul className="space-y-1">
        {summary.lines.map((line) => (
          <li
            key={line.id}
            className="flex items-start justify-between gap-2 rounded-lg bg-white px-2 py-1.5 text-sm"
          >
            <LineDetail line={line} />
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${lineStatusClass(line)}`}
            >
              {lineStatusLabel(line)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ExtraBlock({
  title,
  lines,
  fired,
  allPrepared,
  canFire,
  pending,
  onFire,
  firedLabel,
  accentClass,
}: {
  title: string;
  lines: DiningLineClient[];
  fired: boolean;
  allPrepared: boolean;
  canFire: boolean;
  pending: boolean;
  onFire: () => void;
  firedLabel: string;
  accentClass: string;
}) {
  if (lines.length === 0) return null;

  return (
    <div className={`rounded-xl border border-stone-200 bg-stone-50/50 p-2.5 ${accentClass}`}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-wide text-stone-600">{title}</p>
        {allPrepared ? (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
            Prêt — à servir
          </span>
        ) : fired ? (
          <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-900">
            {firedLabel}
          </span>
        ) : canFire ? (
          <button
            type="button"
            disabled={pending}
            onClick={onFire}
            className={`inline-flex items-center gap-1.5 ${uiBtnPrimarySm}`}
          >
            <Check className="h-3.5 w-3.5" aria-hidden />
            Valider
          </button>
        ) : null}
      </div>
      <ul className="space-y-1">
        {lines.map((line) => (
          <li
            key={line.id}
            className="flex items-start justify-between gap-2 rounded-lg bg-white px-2 py-1.5 text-sm"
          >
            <LineDetail line={line} />
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${lineStatusClass(line)}`}
            >
              {lineStatusLabel(line)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function DiningCoursePanel({
  restaurantId,
  orderId,
  lines,
  pending,
  onTicketApplied,
  onError,
}: Props) {
  const [firing, startTransition] = useTransition();
  const summaries = buildMealCourseSummaries(lines);
  const drinks = barLines(lines);
  const kitchenExtras = kitchenExtraLines(lines);
  const busy = pending || firing;

  function fireCourse(courseType: DiningCourseSummary["courseType"]) {
    onError("");
    startTransition(async () => {
      const res = await fireDiningOrderCourse({ restaurantId, orderId, courseType });
      if (!res.ok || !res.data) {
        onError(res.ok === false ? res.error : "Envoi cuisine impossible.");
        return;
      }
      onTicketApplied(res.data);
    });
  }

  function fireBar() {
    onError("");
    startTransition(async () => {
      const res = await fireDiningOrderBar({ restaurantId, orderId });
      if (!res.ok || !res.data) {
        onError(res.ok === false ? res.error : "Envoi bar impossible.");
        return;
      }
      onTicketApplied(res.data);
    });
  }

  function fireKitchenExtras() {
    onError("");
    startTransition(async () => {
      const res = await fireDiningOrderKitchenExtras({ restaurantId, orderId });
      if (!res.ok || !res.data) {
        onError(res.ok === false ? res.error : "Envoi cuisine impossible.");
        return;
      }
      onTicketApplied(res.data);
    });
  }

  if (summaries.length === 0 && drinks.length === 0 && kitchenExtras.length === 0) return null;

  return (
    <div className="space-y-2 border-b border-stone-100 px-2 py-2">
      <p className="text-[11px] font-semibold text-stone-700">
        Composez le ticket, puis validez chaque bloc pour l&apos;envoyer en cuisine ou au bar.
      </p>
      {summaries.map((summary) => (
        <CourseBlock
          key={summary.courseType}
          summary={summary}
          pending={busy}
          onFire={fireCourse}
        />
      ))}
      <ExtraBlock
        title="Boissons & vins → bar"
        lines={drinks}
        fired={isBarLinesFired(lines)}
        allPrepared={isBarLinesAllPrepared(lines)}
        canFire={canFireBarLines(lines)}
        pending={busy}
        onFire={fireBar}
        firedLabel="Au bar"
        accentClass=""
      />
      <ExtraBlock
        title="Autres → cuisine"
        lines={kitchenExtras}
        fired={isKitchenExtraLinesFired(lines)}
        allPrepared={isKitchenExtraLinesAllPrepared(lines)}
        canFire={canFireKitchenExtraLines(lines)}
        pending={busy}
        onFire={fireKitchenExtras}
        firedLabel="En cuisine"
        accentClass=""
      />
    </div>
  );
}
