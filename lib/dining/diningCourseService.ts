import "server-only";

import type { DiningLineClient } from "@/app/salle/commande/diningOrderTypes";
import {
  buildMealCourseSummaries,
  canFireMealCourse,
} from "@/lib/dining/diningCourseLogic";
import { mealCourseLabel, type DiningMealCourse } from "@/lib/dining/courseTypes";
import { mapLinesToClients } from "@/lib/dining/diningOrderViewData";
import { getDiningOrderLines } from "@/lib/dining/diningDb";
import { loadDiningOrderViewData } from "@/lib/dining/diningOrderViewData";
import { notifyKitchenNewOrderLine } from "@/lib/push/notifyKitchenOrder";
import { notifyServerCourseReady } from "@/lib/push/notifyServerCourseReady";
import { supabaseServer } from "@/lib/supabaseServer";

function courseWasAllPrepared(lines: DiningLineClient[], course: DiningMealCourse): boolean {
  const courseLines = lines.filter((l) => l.courseType === course);
  return courseLines.length > 0 && courseLines.every((l) => l.isPrepared);
}

/** Après marquage « prêt », notifie le serveur si un service vient de se terminer. */
export async function maybeNotifyServerCoursesReady(params: {
  restaurantId: string;
  orderId: string;
  linesBefore: DiningLineClient[];
  linesAfter: DiningLineClient[];
}): Promise<void> {
  const view = await loadDiningOrderViewData(params.restaurantId, params.orderId);
  const orderLabel = view.data?.placeDescription ?? "Table";

  for (const course of ["entrée", "plat", "dessert"] as DiningMealCourse[]) {
    const was = courseWasAllPrepared(params.linesBefore, course);
    const now = courseWasAllPrepared(params.linesAfter, course);
    if (now && !was) {
      const summary = buildMealCourseSummaries(params.linesAfter).find((s) => s.courseType === course);
      if (summary?.fired) {
        void notifyServerCourseReady({
          restaurantId: params.restaurantId,
          orderId: params.orderId,
          orderLabel,
          courseType: course,
        }).catch((err) => console.warn("[dining] push serveur service:", err));
      }
    }
  }
}

export async function fireMealCourseForOrder(params: {
  restaurantId: string;
  orderId: string;
  courseType: DiningMealCourse;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: lines, error } = await getDiningOrderLines(params.orderId, params.restaurantId);
  if (error) return { ok: false, error: error.message };

  const clientLines = mapLinesToClients(lines);
  if (!canFireMealCourse(clientLines, params.courseType)) {
    return {
      ok: false,
      error: `Impossible d'envoyer les ${mealCourseLabel(params.courseType).toLowerCase()} — terminez le service précédent ou vérifiez le ticket.`,
    };
  }

  const now = new Date().toISOString();
  const { error: upErr } = await supabaseServer
    .from("dining_order_lines")
    .update({ sent_to_kitchen_at: now })
    .eq("restaurant_id", params.restaurantId)
    .eq("dining_order_id", params.orderId)
    .eq("course_type", params.courseType)
    .is("sent_to_kitchen_at", null);

  if (upErr) return { ok: false, error: upErr.message };

  const view = await loadDiningOrderViewData(params.restaurantId, params.orderId);
  const orderLabel = view.data?.placeDescription ?? "Commande";
  const firedLines = (view.data?.lines ?? []).filter(
    (l) => l.courseType === params.courseType && l.sentToKitchenAt
  );

  void notifyKitchenNewOrderLine({
    restaurantId: params.restaurantId,
    orderLabel,
    dishName: `${mealCourseLabel(params.courseType)} (${firedLines.length} ligne${firedLines.length > 1 ? "s" : ""})`,
    qty: firedLines.reduce((n, l) => n + l.qty, 0),
  }).catch((err) => console.warn("[dining] push cuisine service:", err));

  return { ok: true };
}
