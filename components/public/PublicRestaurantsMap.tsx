"use client";

import { useEffect, useMemo, useState } from "react";
import {
  APILoadingStatus,
  APIProvider,
  Circle,
  InfoWindow,
  Map,
  Marker,
  useApiLoadingStatus,
  useMap,
  useMapsLibrary,
} from "@vis.gl/react-google-maps";
import { RestaurantMapInfoCard } from "@/components/public/RestaurantMapInfoCard";
import type { GeocodedPlace, Restaurant } from "@/lib/public/types";
import {
  buildGoogleMarkerIcon,
  resolveRestaurantMarkerKind,
  type RestaurantMarkerKind,
} from "@/lib/public/restaurantMapMarker";
import {
  DEFAULT_MAP_CENTER,
  DEFAULT_MAP_ZOOM,
  buildGoogleMapsEmbedUrl,
  hasMapCoordinates,
} from "@/lib/public/mapLinks";
import { getGoogleMapsApiKey, googleMapsLatLng } from "@/lib/public/googleMaps";
import { UBION_PARTNER_MAP_STYLES } from "@/lib/public/mapStyles";

/** Hauteur explicite requise par le composant Map Google. */
export const PUBLIC_MAP_HEIGHT = "min(50vh, 480px)";

type Props = {
  restaurants: Restaurant[];
  searchTarget?: GeocodedPlace | null;
  onOpenRestaurant?: (id: string) => void;
  className?: string;
};

type MappableRestaurant = {
  restaurant: Restaurant;
  marker_kind: RestaurantMarkerKind;
  position: { lat: number; lng: number };
};

function toMappable(restaurant: Restaurant, position: { lat: number; lng: number }): MappableRestaurant {
  return {
    restaurant,
    marker_kind:
      restaurant.marker_kind ??
      resolveRestaurantMarkerKind({
        template_slug: restaurant.template_slug,
        activity_type: restaurant.activity_type,
      }),
    position,
  };
}

function MapViewportController({
  searchTarget,
  markerPoints,
}: {
  searchTarget: GeocodedPlace | null | undefined;
  markerPoints: { lat: number; lng: number }[];
}) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    const points: { lat: number; lng: number }[] = [...markerPoints];
    if (searchTarget) {
      points.push({ lat: searchTarget.lat, lng: searchTarget.lng });
    }

    if (points.length === 0) {
      map.setCenter({ lat: DEFAULT_MAP_CENTER[0], lng: DEFAULT_MAP_CENTER[1] });
      map.setZoom(DEFAULT_MAP_ZOOM);
      return;
    }

    if (points.length === 1) {
      map.setCenter(points[0]);
      map.setZoom(searchTarget && markerPoints.length === 0 ? 12 : 14);
      return;
    }

    const bounds = new google.maps.LatLngBounds();
    for (const point of points) bounds.extend(point);
    map.fitBounds(bounds, { top: 56, right: 56, bottom: 56, left: 56 });
  }, [map, markerPoints, searchTarget]);

  return null;
}

function GeocodeMissingRestaurants({
  restaurants,
  onResolved,
}: {
  restaurants: Restaurant[];
  onResolved: (items: MappableRestaurant[]) => void;
}) {
  const geocoding = useMapsLibrary("geocoding");

  useEffect(() => {
    if (!geocoding) return;

    const missing = restaurants.filter((r) => !hasMapCoordinates(r.latitude, r.longitude));
    if (missing.length === 0) return;

    let cancelled = false;
    const geocoder = new geocoding.Geocoder();

    void (async () => {
      const resolved: MappableRestaurant[] = [];

      for (const restaurant of missing) {
        if (cancelled || !restaurant.address.trim()) continue;
        try {
          const { results } = await geocoder.geocode({
            address: restaurant.address,
            region: "fr",
          });
          const location = results[0]?.geometry?.location;
          if (!location) continue;
          resolved.push(
            toMappable(restaurant, { lat: location.lat(), lng: location.lng() })
          );
        } catch {
          // ignore single failure
        }
      }

      if (!cancelled && resolved.length > 0) {
        onResolved(resolved);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [geocoding, onResolved, restaurants]);

  return null;
}

function GoogleMapInner({
  mappable,
  restaurants,
  searchTarget,
  onOpenRestaurant,
}: {
  mappable: MappableRestaurant[];
  restaurants: Restaurant[];
  searchTarget?: GeocodedPlace | null;
  onOpenRestaurant?: (id: string) => void;
}) {
  const status = useApiLoadingStatus();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [geocoded, setGeocoded] = useState<MappableRestaurant[]>([]);
  const iconsReady = status === APILoadingStatus.LOADED && typeof google !== "undefined";

  const markers = useMemo(() => {
    const byId: Record<string, MappableRestaurant> = {};
    for (const item of mappable) byId[item.restaurant.id] = item;
    for (const item of geocoded) byId[item.restaurant.id] = item;
    return Object.values(byId);
  }, [geocoded, mappable]);

  const defaultCenter = useMemo(() => {
    if (searchTarget) {
      return { lat: searchTarget.lat, lng: searchTarget.lng };
    }
    if (markers.length > 0) return markers[0].position;
    return { lat: DEFAULT_MAP_CENTER[0], lng: DEFAULT_MAP_CENTER[1] };
  }, [markers, searchTarget]);

  const active = markers.find((m) => m.restaurant.id === activeId) ?? null;

  if (
    status === APILoadingStatus.LOADING ||
    status === APILoadingStatus.NOT_LOADED
  ) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-slate-100 text-sm text-slate-600">
        Chargement de Google Maps…
      </div>
    );
  }

  if (status === APILoadingStatus.FAILED || status === APILoadingStatus.AUTH_FAILURE) {
    return (
      <GoogleMapsEmbedFallback
        restaurants={restaurants}
        searchTarget={searchTarget}
        className="h-full w-full"
        error="Impossible de charger Google Maps. Vérifiez la clé API, la facturation et l’activation de « Maps JavaScript API »."
      />
    );
  }

  return (
    <>
      <GeocodeMissingRestaurants restaurants={restaurants} onResolved={setGeocoded} />
      <Map
        defaultCenter={defaultCenter}
        defaultZoom={searchTarget && markers.length === 0 ? 12 : DEFAULT_MAP_ZOOM}
        gestureHandling="greedy"
        fullscreenControl
        mapTypeControl={false}
        streetViewControl={false}
        clickableIcons={false}
        styles={UBION_PARTNER_MAP_STYLES as google.maps.MapTypeStyle[]}
        style={{ width: "100%", height: "100%" }}
      >
        <MapViewportController
          searchTarget={searchTarget}
          markerPoints={markers.map((r) => r.position)}
        />

        {searchTarget ? (
          <>
            <Circle
              center={{ lat: searchTarget.lat, lng: searchTarget.lng }}
              radius={1200}
              fillColor="#3b82f6"
              fillOpacity={0.12}
              strokeColor="#2563eb"
              strokeOpacity={0.45}
              strokeWeight={1}
            />
            <Marker
              position={{ lat: searchTarget.lat, lng: searchTarget.lng }}
              title={searchTarget.label}
              label={{ text: "●", color: "#2563eb", fontSize: "16px", fontWeight: "700" }}
            />
          </>
        ) : null}

        {markers.map((m) => (
          <Marker
            key={m.restaurant.id}
            position={m.position}
            title={m.restaurant.name}
            icon={iconsReady ? buildGoogleMarkerIcon(m.marker_kind) : undefined}
            onClick={() => setActiveId(m.restaurant.id)}
          />
        ))}

        {active ? (
          <InfoWindow
            position={active.position}
            onCloseClick={() => setActiveId(null)}
            maxWidth={280}
            headerDisabled
          >
            <RestaurantMapInfoCard
              restaurant={active.restaurant}
              onOpen={(id) => {
                setActiveId(null);
                onOpenRestaurant?.(id);
              }}
            />
          </InfoWindow>
        ) : null}
      </Map>
    </>
  );
}

function GoogleMapsEmbedFallback({
  restaurants,
  searchTarget,
  className,
  error,
}: {
  restaurants: Restaurant[];
  searchTarget?: GeocodedPlace | null;
  className?: string;
  error?: string;
}) {
  const embedUrl = searchTarget
    ? buildGoogleMapsEmbedUrl({
        address: searchTarget.label,
        latitude: searchTarget.lat,
        longitude: searchTarget.lng,
      })
    : (() => {
        const withCoords = restaurants.find((r) =>
          hasMapCoordinates(r.latitude, r.longitude)
        );
        const sample = withCoords ?? restaurants[0];
        return sample
          ? buildGoogleMapsEmbedUrl({
              address: sample.address,
              name: sample.name,
              latitude: sample.latitude,
              longitude: sample.longitude,
            })
          : buildGoogleMapsEmbedUrl({ address: "Paris, France" });
      })();

  return (
    <div className={`relative overflow-hidden bg-slate-100 ${className ?? ""}`}>
      <iframe
        title="Carte Google Maps"
        src={embedUrl}
        className="h-full w-full border-0"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        allowFullScreen
      />
      {error ? (
        <p className="absolute bottom-3 left-3 right-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-center text-xs text-amber-900 shadow-sm">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function PublicRestaurantsMap({
  restaurants,
  searchTarget,
  onOpenRestaurant,
  className = "",
}: Props) {
  const apiKey = getGoogleMapsApiKey();

  const mappable = useMemo(
    () =>
      restaurants
        .filter((r) => hasMapCoordinates(r.latitude, r.longitude))
        .map((r) => toMappable(r, googleMapsLatLng(r.latitude!, r.longitude!))),
    [restaurants]
  );

  const containerStyle = {
    height: PUBLIC_MAP_HEIGHT,
    minHeight: 280,
    width: "100%",
  } as const;

  if (!apiKey) {
    return (
      <div style={containerStyle} className={className}>
        <GoogleMapsEmbedFallback
          restaurants={restaurants}
          searchTarget={searchTarget}
          className="h-full w-full"
          error="Ajoutez NEXT_PUBLIC_GOOGLE_MAPS_API_KEY dans .env.local puis redémarrez le serveur (npm run dev:webpack)."
        />
      </div>
    );
  }

  return (
    <div style={containerStyle} className={className}>
      <APIProvider apiKey={apiKey} language="fr" region="FR">
        <div className="h-full w-full overflow-hidden">
          <GoogleMapInner
            mappable={mappable}
            restaurants={restaurants}
            searchTarget={searchTarget}
            onOpenRestaurant={onOpenRestaurant}
          />
        </div>
      </APIProvider>
    </div>
  );
}
