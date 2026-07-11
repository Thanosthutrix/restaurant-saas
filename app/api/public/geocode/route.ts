import { NextResponse } from "next/server";
import type { GeocodedPlace } from "@/lib/public/types";
import { rateLimit, getClientIp } from "@/lib/rateLimit";

export async function GET(request: Request) {
  // Route publique (portail consommateur) : pas d'auth possible, mais on limite
  // par IP pour éviter qu'un tiers ne fasse cramer le quota Google Geocoding.
  const limited = rateLimit(`geocode:${getClientIp(request)}`, 30, 60_000);
  if (!limited.ok) {
    return NextResponse.json(
      { place: null, error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } }
    );
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  if (!q) {
    return NextResponse.json({ place: null as GeocodedPlace | null });
  }
  if (q.length > 200) {
    return NextResponse.json({ place: null, error: "query_too_long" }, { status: 400 });
  }

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({ place: null, error: "missing_api_key" }, { status: 503 });
  }

  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", q);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("region", "fr");
  url.searchParams.set("language", "fr");

  try {
    const res = await fetch(url.toString(), { next: { revalidate: 3600 } });
    if (!res.ok) {
      return NextResponse.json({ place: null }, { status: 502 });
    }

    const data = (await res.json()) as {
      status: string;
      results?: Array<{
        formatted_address?: string;
        geometry?: { location?: { lat: number; lng: number } };
      }>;
    };

    if (data.status !== "OK" || !data.results?.[0]?.geometry?.location) {
      return NextResponse.json({ place: null });
    }

    const { lat, lng } = data.results[0].geometry.location;
    const place: GeocodedPlace = {
      lat,
      lng,
      label: data.results[0].formatted_address ?? q,
    };

    return NextResponse.json({ place });
  } catch {
    return NextResponse.json({ place: null }, { status: 502 });
  }
}
