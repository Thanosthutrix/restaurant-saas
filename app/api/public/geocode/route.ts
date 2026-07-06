import { NextResponse } from "next/server";
import type { GeocodedPlace } from "@/lib/public/types";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  if (!q) {
    return NextResponse.json({ place: null as GeocodedPlace | null });
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
