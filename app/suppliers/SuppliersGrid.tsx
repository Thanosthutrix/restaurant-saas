"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Truck, X } from "lucide-react";
import type { Supplier } from "@/lib/db";
import { EditSupplierForm } from "./[id]/EditSupplierForm";

const ORDER_METHOD_LABELS: Record<string, string> = {
  EMAIL: "Email",
  WHATSAPP: "WhatsApp",
  PHONE: "Téléphone",
  PORTAL: "Portail",
};

function cardSubtitle(s: Supplier): string {
  return [
    ORDER_METHOD_LABELS[s.preferred_order_method] ?? s.preferred_order_method,
    (s.order_days?.length ?? 0) > 0 ? (s.order_days ?? []).join(", ") : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function SuppliersGrid({ suppliers }: { suppliers: Supplier[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const open = suppliers.find((s) => s.id === openId) ?? null;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenId(null);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
        {suppliers.map((s) => {
          const active = s.id === openId;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setOpenId(active ? null : s.id)}
              aria-expanded={active}
              className={`group flex aspect-square flex-col items-center justify-center gap-2 rounded-2xl border p-4 text-center transition ${
                active
                  ? "border-copper-300 bg-copper-50/50 shadow-md ring-1 ring-copper-200"
                  : "border-stone-200/70 bg-white shadow-sm hover:-translate-y-0.5 hover:border-copper-200 hover:shadow-md"
              } ${!s.is_active ? "opacity-70" : ""}`}
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-copper-50 ring-1 ring-copper-100/90">
                <Truck className="h-7 w-7 text-copper-700" aria-hidden />
              </span>
              <span className="line-clamp-2 text-sm font-semibold leading-tight text-stone-900">{s.name}</span>
              <span className="line-clamp-1 text-xs text-stone-500">
                {s.is_active ? cardSubtitle(s) : "Inactif"}
              </span>
            </button>
          );
        })}
      </div>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-stone-900/40 p-4 backdrop-blur-sm sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label={`Fournisseur ${open.name}`}
          onClick={() => setOpenId(null)}
        >
          <div
            className="my-6 w-full max-w-lg overflow-hidden rounded-2xl border border-stone-200/80 bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-stone-100 bg-stone-50/60 px-4 py-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-copper-50 ring-1 ring-copper-100/90">
                <Truck className="h-5 w-5 text-copper-700" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-stone-900">{open.name}</p>
                <p className="text-xs text-stone-500">
                  {ORDER_METHOD_LABELS[open.preferred_order_method] ?? open.preferred_order_method}
                  {!open.is_active ? " · Inactif" : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpenId(null)}
                className="ml-auto flex h-9 w-9 items-center justify-center rounded-lg text-stone-500 transition hover:bg-stone-100 hover:text-stone-800"
                aria-label="Fermer"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>

            <div className="max-h-[78vh] space-y-3 overflow-y-auto bg-stone-50/50 px-4 py-4">
              <EditSupplierForm supplier={open} />
              <Link
                href={`/suppliers/${open.id}`}
                className="inline-flex items-center gap-1.5 px-1 text-sm font-semibold text-copper-700 transition hover:text-copper-600"
              >
                Historique : commandes, BL et factures
                <ArrowUpRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
