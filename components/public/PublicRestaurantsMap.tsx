"use client";

import { useEffect, useMemo } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import type { Restaurant } from "@/lib/public/types";
import {
  DEFAULT_MAP_CENTER,
  DEFAULT_MAP_ZOOM,
  hasMapCoordinates,
} from "@/lib/public/mapLinks";
import "leaflet/dist/leaflet.css";

type Props = {
  restaurants: Restaurant[];
  onSelect?: (id: string) => void;
  className?: string;
};

const markerIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();

  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 15);
      return;
    }
    map.fitBounds(L.latLngBounds(points), { padding: [32, 32], maxZoom: 15 });
  }, [map, points]);

  return null;
}

export function PublicRestaurantsMap({
  restaurants,
  onSelect,
  className = "",
}: Props) {
  const mappable = useMemo(
    () =>
      restaurants.filter((r) => hasMapCoordinates(r.latitude, r.longitude)).map((r) => ({
        id: r.id,
        name: r.name,
        address: r.address,
        cuisine_type: r.cuisine_type,
        position: [r.latitude!, r.longitude!] as [number, number],
      })),
    [restaurants]
  );

  const center = mappable.length > 0 ? mappable[0].position : DEFAULT_MAP_CENTER;

  if (mappable.length === 0) {
    return (
      <div
        className={`flex aspect-square flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center ${className}`}
      >
        <p className="text-sm font-semibold text-slate-700">Carte bientôt disponible</p>
        <p className="text-xs leading-relaxed text-slate-500">
          Les restaurants apparaîtront ici dès que leur adresse est géolocalisée dans l&apos;ERP.
        </p>
      </div>
    );
  }

  return (
    <div className={`aspect-square overflow-hidden rounded-2xl border border-slate-200 ${className}`}>
      <MapContainer
        center={center}
        zoom={DEFAULT_MAP_ZOOM}
        scrollWheelZoom={false}
        style={{ height: "100%", width: "100%" }}
        className="z-0"
        aria-label="Carte interactive des restaurants"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds points={mappable.map((r) => r.position)} />

        {mappable.map((r) => (
          <Marker
            key={r.id}
            position={r.position}
            icon={markerIcon}
            eventHandlers={{
              click: () => onSelect?.(r.id),
            }}
          >
            <Popup>
              <div className="min-w-[160px]" data-restaurant-id={r.id}>
                <p className="font-bold text-slate-900">{r.name}</p>
                <p className="mt-0.5 text-xs text-slate-600">{r.cuisine_type}</p>
                <p className="mt-1 text-xs text-slate-500">{r.address}</p>
                {onSelect ? (
                  <button
                    type="button"
                    onClick={() => onSelect(r.id)}
                    className="mt-2 text-xs font-semibold text-orange-600 hover:text-orange-700"
                  >
                    Voir la fiche →
                  </button>
                ) : null}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
