import { geocodeAddressFr } from "@/lib/geo/geocodeAddressFr";
import type { SchoolZone } from "@/lib/calendar/schoolVacationsFr";

/** Prépare adresse + coordonnées pour une création de restaurant (zone scolaire déduite du géocodage). */
export async function resolveAddressForRestaurantInsert(addressRaw: string | null | undefined): Promise<
  | {
      ok: true;
      address_text: string | null;
      latitude: number | null;
      longitude: number | null;
      school_zone: SchoolZone | null;
    }
  | { ok: false; error: string }
> {
  const trimmed = typeof addressRaw === "string" ? addressRaw.trim() : "";
  const address_text = trimmed.length > 0 ? trimmed : null;
  if (!address_text) {
    return {
      ok: true,
      address_text: null,
      latitude: null,
      longitude: null,
      school_zone: null,
    };
  }
  const geo = await geocodeAddressFr(address_text);
  if (!geo) {
    return {
      ok: false,
      error: "Adresse introuvable. Indiquez le numéro, la rue et la ville (France).",
    };
  }
  return {
    ok: true,
    address_text,
    latitude: geo.latitude,
    longitude: geo.longitude,
    school_zone: geo.schoolZone,
  };
}
