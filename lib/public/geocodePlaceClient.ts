import type { GeocodedPlace } from "@/lib/public/types";

export async function geocodePlaceClient(query: string): Promise<GeocodedPlace | null> {
  const q = query.trim();
  if (!q) return null;

  try {
    const res = await fetch(`/api/public/geocode?q=${encodeURIComponent(q)}`);
    if (!res.ok) return null;
    const data = (await res.json()) as { place: GeocodedPlace | null };
    return data.place;
  } catch {
    return null;
  }
}
