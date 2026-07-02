import { Flame, PackageCheck, Refrigerator, Snowflake, ThermometerSnowflake, type LucideIcon } from "lucide-react";
import type { TemperaturePointType, TemperatureLogStatus } from "@/lib/haccpTemperature/types";

/** Icône + teinte + classe de survol par type de point (identité visuelle des tuiles). */
export function pointTypeMeta(type: TemperaturePointType): { Icon: LucideIcon; tone: string; tile: string } {
  switch (type) {
    case "cold_storage":
      return { Icon: Refrigerator, tone: "bg-sky-50 text-sky-700", tile: "tile-sky" };
    case "freezer":
      return { Icon: Snowflake, tone: "bg-cyan-50 text-cyan-700", tile: "tile-cyan" };
    case "hot_holding":
      return { Icon: Flame, tone: "bg-amber-50 text-amber-700", tile: "tile-amber" };
    case "cooling":
      return { Icon: ThermometerSnowflake, tone: "bg-violet-50 text-violet-700", tile: "tile-violet" };
    case "receiving":
      return { Icon: PackageCheck, tone: "bg-emerald-50 text-emerald-700", tile: "tile-emerald" };
  }
}

export type StatusMeta = { chip: string; text: string; ring: string; label: string };

/** Palette de statut de relevé : normal / alerte / critique. */
export function statusMeta(status: TemperatureLogStatus): StatusMeta {
  if (status === "critical") {
    return { chip: "bg-rose-100 text-rose-800", text: "text-rose-700", ring: "border-rose-300", label: "Écart critique" };
  }
  if (status === "alert") {
    return { chip: "bg-amber-100 text-amber-900", text: "text-amber-800", ring: "border-amber-300", label: "Alerte (proche seuil)" };
  }
  return { chip: "bg-emerald-100 text-emerald-800", text: "text-emerald-700", ring: "border-emerald-200", label: "Normal" };
}

/** Pastille de statut colorée. */
export function StatusPill({ status }: { status: TemperatureLogStatus }) {
  const m = statusMeta(status);
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${m.chip}`}>{m.label}</span>
  );
}

/** Température formatée (°C, virgule française). */
export function fmtTemp(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${String(v).replace(".", ",")} °C`;
}
