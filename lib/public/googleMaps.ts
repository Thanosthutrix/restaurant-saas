export function getGoogleMapsApiKey(): string | undefined {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim();
  return key || undefined;
}

export type MapLatLng = { lat: number; lng: number };

export function googleMapsLatLng(latitude: number, longitude: number): MapLatLng {
  return { lat: latitude, lng: longitude };
}
