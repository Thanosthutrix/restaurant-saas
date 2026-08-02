import { Droplets, type LucideIcon } from "lucide-react";
import type { FryerOilLogStatus } from "@/lib/fryerOil/types";

export function fryerStatusMeta(status: FryerOilLogStatus): {
  chip: string;
  text: string;
  ring: string;
  label: string;
} {
  if (status === "critical") {
    return {
      chip: "bg-rose-100 text-rose-800",
      text: "text-rose-700",
      ring: "border-rose-300",
      label: "Changement requis",
    };
  }
  if (status === "alert") {
    return {
      chip: "bg-amber-100 text-amber-900",
      text: "text-amber-800",
      ring: "border-amber-300",
      label: "Alerte",
    };
  }
  return {
    chip: "bg-emerald-100 text-emerald-800",
    text: "text-emerald-700",
    ring: "border-emerald-200",
    label: "Conforme",
  };
}

export function FryerStatusPill({ status }: { status: FryerOilLogStatus }) {
  const m = fryerStatusMeta(status);
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${m.chip}`}>
      {m.label}
    </span>
  );
}

export function fmtTpm(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${String(v).replace(".", ",")} %`;
}

export function fmtOilTemp(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${String(v).replace(".", ",")} °C`;
}

export const FRYER_TILE = {
  Icon: Droplets as LucideIcon,
  tone: "bg-amber-50 text-amber-800",
  tile: "tile-amber",
};
