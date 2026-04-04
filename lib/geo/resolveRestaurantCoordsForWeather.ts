import { geocodeAddressFr } from "@/lib/geo/geocodeAddressFr";

/**
 * Coordonnées pour la météo : base de données, sinon géocodage de l’adresse (sans écrire en base).
 */
export async function resolveRestaurantCoordsForWeather(r: {
  latitude: number | null;
  longitude: number | null;
  address_text: string | null;
}): Promise<{ latitude: number; longitude: number } | null> {
  const lat = r.latitude;
  const lng = r.longitude;
  if (lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng)) {
    return { latitude: lat, longitude: lng };
  }
  const addr = r.address_text?.trim();
  if (!addr) return null;
  const geo = await geocodeAddressFr(addr);
  if (!geo) return null;
  return { latitude: geo.latitude, longitude: geo.longitude };
}
