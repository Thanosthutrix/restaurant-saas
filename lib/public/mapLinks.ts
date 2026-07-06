export type MapLocationInput = {
  address: string;
  name?: string;
  latitude?: number | null;
  longitude?: number | null;
};

export function buildGoogleMapsSearchUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

export function buildAppleMapsUrl(input: MapLocationInput): string {
  const q = encodeURIComponent(input.name?.trim() || input.address);
  if (input.latitude != null && input.longitude != null) {
    return `https://maps.apple.com/?ll=${input.latitude},${input.longitude}&q=${q}`;
  }
  return `https://maps.apple.com/?address=${encodeURIComponent(input.address)}`;
}

export function buildGoogleMapsEmbedUrl(input: MapLocationInput): string {
  if (input.latitude != null && input.longitude != null) {
    return `https://maps.google.com/maps?q=${input.latitude},${input.longitude}&z=16&output=embed`;
  }
  return `https://maps.google.com/maps?q=${encodeURIComponent(input.address)}&output=embed`;
}

/** Détecte iOS / iPadOS / macOS pour mettre Plans en avant. */
export function isApplePlatform(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod|Mac OS X|Macintosh/.test(navigator.userAgent);
}

export function hasMapCoordinates(
  latitude?: number | null,
  longitude?: number | null
): latitude is number {
  return latitude != null && longitude != null && Number.isFinite(latitude) && Number.isFinite(longitude);
}

/** Centre par défaut : Paris intra-muros. */
export const DEFAULT_MAP_CENTER: [number, number] = [48.8566, 2.3522];
export const DEFAULT_MAP_ZOOM = 12;
