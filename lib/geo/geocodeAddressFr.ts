/**
 * Géocodage France via l’API Adresse (Base Adresse Nationale, data.gouv).
 * https://adresse.data.gouv.fr/api-doc/adresse
 */

import { departmentFromFrenchPostcode, schoolZoneFromDepartment } from "@/lib/geo/frDepartmentSchoolZone";
import type { SchoolZone } from "@/lib/calendar/schoolVacationsFr";

export type GeocodeFrResult = {
  latitude: number;
  longitude: number;
  label: string;
  postcode: string | null;
  department: string | null;
  /** Zone vacances déduite du département (null si DOM ou indéterminé). */
  schoolZone: SchoolZone | null;
};

type BanFeature = {
  geometry?: { type: string; coordinates: [number, number] };
  properties?: {
    label?: string;
    postcode?: string;
    city?: string;
    score?: number;
  };
};

export async function geocodeAddressFr(query: string): Promise<GeocodeFrResult | null> {
  const q = query.trim();
  if (!q) return null;

  const url = new URL("https://api-adresse.data.gouv.fr/search/");
  url.searchParams.set("q", q);
  url.searchParams.set("limit", "1");

  const res = await fetch(url.toString(), {
    headers: { "User-Agent": "RestaurantSaaS/1.0 (geocodage restaurant)" },
    next: { revalidate: 60 * 60 * 24 * 30 },
  });

  if (!res.ok) return null;

  const json = (await res.json()) as { features?: BanFeature[] };
  const f = json.features?.[0];
  const coords = f?.geometry?.coordinates;
  if (!coords || coords.length < 2) return null;

  const [lon, lat] = coords;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  const props = f.properties ?? {};
  const postcode = props.postcode?.trim() || null;
  const department = departmentFromFrenchPostcode(postcode);
  const schoolZone = schoolZoneFromDepartment(department);

  return {
    latitude: lat,
    longitude: lon,
    label: props.label?.trim() || q,
    postcode,
    department,
    schoolZone,
  };
}
