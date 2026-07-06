/** Slugs / activités ERP reconnus pour les pictogrammes carte. */
export type RestaurantMarkerKind =
  | "pizzeria"
  | "snack-fastfood"
  | "brasserie-traditionnel"
  | "boulangerie-patisserie"
  | "bar-cafe"
  | "glacier-crepe-gaufre"
  | "food_truck"
  | "catering"
  | "cafe"
  | "restaurant"
  | "other";

const KNOWN_KINDS = new Set<string>([
  "pizzeria",
  "snack-fastfood",
  "brasserie-traditionnel",
  "boulangerie-patisserie",
  "bar-cafe",
  "glacier-crepe-gaufre",
  "food_truck",
  "catering",
  "cafe",
  "restaurant",
  "other",
]);

const MARKER_GLYPH: Record<RestaurantMarkerKind, string> = {
  pizzeria: "🍕",
  "snack-fastfood": "🍔",
  "brasserie-traditionnel": "🍽️",
  "boulangerie-patisserie": "🥐",
  "bar-cafe": "☕",
  "glacier-crepe-gaufre": "🍦",
  food_truck: "🚚",
  catering: "🎉",
  cafe: "☕",
  restaurant: "🍴",
  other: "📍",
};

const iconCache = new Map<RestaurantMarkerKind, string>();

export function resolveRestaurantMarkerKind(input: {
  template_slug?: string | null;
  activity_type?: string | null;
}): RestaurantMarkerKind {
  const slug = input.template_slug?.trim();
  if (slug && KNOWN_KINDS.has(slug)) {
    return slug as RestaurantMarkerKind;
  }

  const activity = input.activity_type?.trim();
  if (activity && KNOWN_KINDS.has(activity)) {
    return activity as RestaurantMarkerKind;
  }

  if (activity === "cafe") return "cafe";
  if (activity === "food_truck") return "food_truck";
  if (activity === "catering") return "catering";
  if (activity === "restaurant") return "restaurant";

  return "other";
}

function buildGlyphSvg(glyph: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
  <text x="16" y="24" text-anchor="middle" font-size="26" style="paint-order:stroke;stroke:#fff;stroke-width:3px">${glyph}</text>
</svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export function getRestaurantMarkerIconUrl(kind: RestaurantMarkerKind): string {
  const cached = iconCache.get(kind);
  if (cached) return cached;

  const url = buildGlyphSvg(MARKER_GLYPH[kind] ?? MARKER_GLYPH.other);
  iconCache.set(kind, url);
  return url;
}

export function buildGoogleMarkerIcon(
  kind: RestaurantMarkerKind
): google.maps.Icon {
  return {
    url: getRestaurantMarkerIconUrl(kind),
    scaledSize: new google.maps.Size(32, 32),
    anchor: new google.maps.Point(16, 16),
  };
}
