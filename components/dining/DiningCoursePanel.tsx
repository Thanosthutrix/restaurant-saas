"use client";

import { useTransition } from "react";
import { Flame } from "lucide-react";
import { fireDiningOrderCourse } from "@/app/salle/actions";
import type { DiningLineClient } from "@/app/salle/commande/diningOrderTypes";
import {
  buildMealCourseSummaries,
  otherLines,
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
  if (line.sentToKitchenAt) return "En cuisine";
  return "En attente";
}

function lineStatusClass(line: DiningLineClient): string {
  if (line.isPrepared) return "bg-emerald-100 text-emerald-800";
  if (line.sentToKitchenAt) return "bg-amber-100 text-amber-900";
  return "bg-stone-100 text-stone-600";
}

function CourseBlock({
  summary,
  restaurantId,
  orderId,
  pending,
  onFire,
}: {
  summary: DiningCourseSummary;
  restaurantId: string;
  orderId: string;
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
            <Flame className="h-3.5 w-3.5" aria-hidden />
            Envoyer {summary.label.toLowerCase()}
          </button>
        ) : (
          <span className={`text-[10px] ${uiLead}`}>Terminez le service précédent</span>
        )}
      </div>
      <ul className="space-y-1">
        {summary.lines.map((line) => (
          <li
            key={line.id}
            className="flex items-center justify-between gap-2 rounded-lg bg-white px-2 py-1.5 text-sm"
          >
            <span className="min-w-0 truncate font-medium text-stone-900">
              ×{line.qty} {line.dishName}
            </span>
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
  const extras = otherLines(lines);
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

  if (summaries.length === 0 && extras.length === 0) return null;

  return (
    <div className="space-y-2 border-b border-stone-100 px-2 py-2">
      <p className="text-[11px] font-semibold text-stone-700">
        Services — envoyez entrées, puis plats, puis desserts
      </p>
      {summaries.map((summary) => (
        <CourseBlock
          key={summary.courseType}
          summary={summary}
          restaurantId={restaurantId}
          orderId={orderId}
          pending={busy}
          onFire={fireCourse}
        />
      ))}
      {extras.length > 0 ? (
        <div className="rounded-xl border border-stone-200 bg-stone-50/50 p-2.5">
          <p className="mb-1 text-xs font-bold uppercase tracking-wide text-stone-500">Boissons / autres</p>
          <ul className="space-y-1">
            {extras.map((line) => (
              <li key={line.id} className="flex items-center justify-between gap-2 text-sm text-stone-700">
                <span>
                  ×{line.qty} {line.dishName}
                </span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${lineStatusClass(line)}`}>
                  {lineStatusLabel(line)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
