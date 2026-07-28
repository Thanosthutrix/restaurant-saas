import "server-only";

import { mealCourseReadyPushTitle, type DiningMealCourse } from "@/lib/dining/courseTypes";
import { isPushSendConfigured } from "./pushConfig";
import { listPushTokensForRestaurant } from "./pushTokenDb";
import { sendPushToDevices } from "./pushSendService";

/** Notifie le serveur qu'un service (entrées / plats / desserts) est prêt à être servi. */
export async function notifyServerCourseReady(params: {
  restaurantId: string;
  orderId: string;
  orderLabel: string;
  courseType: DiningMealCourse;
}): Promise<{ sent: number; failed: number; skipped: boolean }> {
  if (!isPushSendConfigured()) {
    return { sent: 0, failed: 0, skipped: true };
  }

  const tokens = await listPushTokensForRestaurant(params.restaurantId);
  if (tokens.length === 0) {
    return { sent: 0, failed: 0, skipped: true };
  }

  const course = mealCourseReadyPushTitle(params.courseType);
  const result = await sendPushToDevices({
    tokens,
    title: `${course} · ${params.orderLabel}`,
    body: "Tous les plats du service sont prêts — vous pouvez servir.",
    data: {
      type: "dining_course_ready",
      orderId: params.orderId,
      restaurantId: params.restaurantId,
      courseType: params.courseType,
      url: `/salle/commande/${params.orderId}`,
    },
  });

  return { ...result, skipped: false };
}
