"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Coque de modale pour la fiche client interceptée (navigation depuis la liste).
 * Ferme via router.back() — l'accès direct/refresh affiche la page complète.
 */
export function ClientDetailModal({
  name,
  subtitle,
  children,
}: {
  name: string;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
}) {
  const router = useRouter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") router.back();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [router]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-stone-900/40 p-4 backdrop-blur-sm sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={`Fiche de ${name}`}
      onClick={() => router.back()}
    >
      <div
        className="my-6 w-full max-w-4xl overflow-hidden rounded-2xl border border-stone-200/80 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-stone-100 bg-white/95 px-4 py-3 backdrop-blur-sm">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-copper-50 text-sm font-bold text-copper-800 ring-1 ring-copper-100/90">
            {initials(name)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-stone-900">{name}</p>
            {subtitle ? <p className="truncate text-xs text-stone-500">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={() => router.back()}
            className="ml-auto flex h-9 w-9 items-center justify-center rounded-lg text-stone-500 transition hover:bg-stone-100 hover:text-stone-800"
            aria-label="Fermer"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <div className="max-h-[80vh] overflow-y-auto bg-stone-50/40 px-4 py-4 sm:px-5">{children}</div>
      </div>
    </div>
  );
}
