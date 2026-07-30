import "server-only";

import type { DiningLineClient } from "@/app/salle/commande/diningOrderTypes";
import {
  buildMealCourseSummaries,
  canFireBarLines,
  canFireKitchenExtraLines,
  canFireMealCourse,
  kitchenExtraLines,
} from "@/lib/dining/diningCourseLogic";
import { mealCourseLabel, type DiningMealCourse } from "@/lib/dining/courseTypes";
import {
  listLineModificationsByLineIds,
  validateKitchenModsForLine,
} from "@/lib/dining/diningLineModificationsDb";
import { getDiningOrderLines } from "@/lib/dining/diningDb";
import { loadDiningOrderViewData, mapLinesToClientsEnriched } from "@/lib/dining/diningOrderViewData";
import { buildSnapshotFromModifications } from "@/lib/dining/lineModificationLogic";
import { notifyBarOrderBatch, notifyKitchenOrderBatch } from "@/lib/push/notifyKitchenOrder";
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

async function snapshotModsForLines(restaurantId: string, lineIds: string[]): Promise<void> {
  if (lineIds.length === 0) return;
  const modsByLineId = await listLineModificationsByLineIds(restaurantId, lineIds);
  for (const lineId of lineIds) {
    const mods = modsByLineId.get(lineId) ?? [];
    await validateKitchenModsForLine({
      restaurantId,
      lineId,
      snapshot: buildSnapshotFromModifications(mods),
      lineAlreadySentToKitchen: false,
    });
  }
}

type SendBatchParams = {
  restaurantId: string;
  orderId: string;
  lineIds: string[];
  batchLabel: string;
  destination: "kitchen" | "bar";
};

/** Envoie un lot validé (snapshot modifs + sent_to_kitchen_at + une notif). */
async function sendOrderBatch(
  params: SendBatchParams
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { restaurantId, orderId, lineIds, batchLabel, destination } = params;
  if (lineIds.length === 0) {
    return { ok: false, error: "Aucune ligne à envoyer." };
  }

  await snapshotModsForLines(restaurantId, lineIds);

  const now = new Date().toISOString();
  const { error: upErr } = await supabaseServer
    .from("dining_order_lines")
    .update({ sent_to_kitchen_at: now })
    .eq("restaurant_id", restaurantId)
    .eq("dining_order_id", orderId)
    .in("id", lineIds)
    .is("sent_to_kitchen_at", null);

  if (upErr) return { ok: false, error: upErr.message };

  const view = await loadDiningOrderViewData(restaurantId, orderId);
  const orderLabel = view.data?.placeDescription ?? "Commande";
  const sentLines = (view.data?.lines ?? []).filter((l) => lineIds.includes(l.id));

  const notifyLines = sentLines.map((l) => ({
    dishName: l.dishName,
    qty: l.qty,
    kitchenLabels: l.kitchenLabels,
  }));

  if (destination === "bar") {
    void notifyBarOrderBatch({
      restaurantId,
      orderLabel,
      batchLabel,
      lines: notifyLines,
    }).catch((err) => console.warn("[dining] push bar lot:", err));
  } else {
    void notifyKitchenOrderBatch({
      restaurantId,
      orderLabel,
      batchLabel,
      lines: notifyLines,
    }).catch((err) => console.warn("[dining] push cuisine lot:", err));
  }

  return { ok: true };
}

export async function fireMealCourseForOrder(params: {
  restaurantId: string;
  orderId: string;
  courseType: DiningMealCourse;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: lines, error } = await getDiningOrderLines(params.orderId, params.restaurantId);
  if (error) return { ok: false, error: error.message };

  const clientLines = await mapLinesToClientsEnriched(params.restaurantId, lines);
  if (!canFireMealCourse(clientLines, params.courseType)) {
    return {
      ok: false,
      error: `Impossible d'envoyer les ${mealCourseLabel(params.courseType).toLowerCase()} — terminez le service précédent ou vérifiez le ticket.`,
    };
  }

  const lineIds = clientLines
    .filter((l) => l.courseType === params.courseType && !l.sentToKitchenAt)
    .map((l) => l.id);

  return sendOrderBatch({
    restaurantId: params.restaurantId,
    orderId: params.orderId,
    lineIds,
    batchLabel: mealCourseLabel(params.courseType),
    destination: "kitchen",
  });
}

export async function fireBarLinesForOrder(params: {
  restaurantId: string;
  orderId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: lines, error } = await getDiningOrderLines(params.orderId, params.restaurantId);
  if (error) return { ok: false, error: error.message };

  const clientLines = await mapLinesToClientsEnriched(params.restaurantId, lines);
  if (!canFireBarLines(clientLines)) {
    return { ok: false, error: "Aucune boisson à envoyer au bar." };
  }

  const lineIds = clientLines
    .filter((l) => l.isBarLine && !l.sentToKitchenAt)
    .map((l) => l.id);

  return sendOrderBatch({
    restaurantId: params.restaurantId,
    orderId: params.orderId,
    lineIds,
    batchLabel: "Boissons",
    destination: "bar",
  });
}

export async function fireKitchenExtraLinesForOrder(params: {
  restaurantId: string;
  orderId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: lines, error } = await getDiningOrderLines(params.orderId, params.restaurantId);
  if (error) return { ok: false, error: error.message };

  const clientLines = await mapLinesToClientsEnriched(params.restaurantId, lines);
  if (!canFireKitchenExtraLines(clientLines)) {
    return { ok: false, error: "Aucun autre article cuisine à envoyer." };
  }

  const lineIds = kitchenExtraLines(clientLines)
    .filter((l) => !l.sentToKitchenAt)
    .map((l) => l.id);

  return sendOrderBatch({
    restaurantId: params.restaurantId,
    orderId: params.orderId,
    lineIds,
    batchLabel: "Autres",
    destination: "kitchen",
  });
}

/** @deprecated Utiliser fireBarLinesForOrder */
export async function fireOtherLinesForOrder(params: {
  restaurantId: string;
  orderId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  return fireBarLinesForOrder(params);
}
