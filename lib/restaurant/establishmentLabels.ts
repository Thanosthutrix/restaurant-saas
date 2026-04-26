import type { Restaurant } from "@/lib/auth";
import { getRestaurantTemplateBySlug } from "@/lib/templates/restaurantTemplates";

/** Libellés affichés dans le header / fiche établissement (sans logique async). */
export function getEstablishmentLabels(r: Restaurant) {
  const templateName = r.template_slug
    ? getRestaurantTemplateBySlug(r.template_slug)?.name ?? r.template_slug
    : null;
  const templateFromActivity = r.activity_type ? getRestaurantTemplateBySlug(r.activity_type) : undefined;
  const activityMatchesTemplateSlug = templateFromActivity?.name ?? null;
  const legacyActivityLabel =
    r.activity_type === "restaurant"
      ? "Restaurant"
      : r.activity_type === "cafe"
        ? "Café / Brasserie"
        : r.activity_type === "food_truck"
          ? "Food truck"
          : r.activity_type === "catering"
            ? "Traiteur"
            : r.activity_type === "other"
              ? "Autre"
              : r.activity_type ?? null;
  const activityLabel =
    templateName ?? activityMatchesTemplateSlug ?? legacyActivityLabel ?? "—";
  const serviceLabel =
    r.service_type === "lunch"
      ? "Déjeuner"
      : r.service_type === "dinner"
        ? "Dîner"
        : r.service_type === "both"
          ? "Déjeuner et dîner"
          : r.service_type ?? "—";

  const emailSenderLabel = r.messaging_sender_display_name?.trim() || r.name;

  return {
    activityLabel,
    serviceLabel,
    avgCovers: r.avg_covers,
    emailSenderLabel,
  };
}
