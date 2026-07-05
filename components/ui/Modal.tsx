"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import type { LucideIcon } from "lucide-react";

/**
 * Shell de modale premium : fond flouté, en-tête collant (icône + titre),
 * bouton X, fermeture Échap + clic extérieur, verrou du scroll body.
 * Pied optionnel collant pour les actions.
 */
export function Modal({
  title,
  subtitle,
  icon: Icon,
  tone = "bg-copper-50 text-copper-700",
  onClose,
  children,
  footer,
  size = "md",
}: {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  tone?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: "md" | "lg" | "xl";
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-stone-900/40 p-4 backdrop-blur-sm sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div
        className={`my-6 w-full ${
          size === "xl" ? "max-w-4xl" : size === "lg" ? "max-w-2xl" : "max-w-lg"
        } overflow-hidden rounded-2xl border border-stone-200/80 bg-white shadow-2xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-stone-100 bg-white/95 px-4 py-3 backdrop-blur-sm">
          {Icon ? (
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${tone}`}>
              <Icon className="h-4.5 w-4.5" aria-hidden />
            </span>
          ) : null}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-stone-900">{title}</p>
            {subtitle ? <p className="truncate text-xs text-stone-500">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="rounded-lg p-1.5 text-stone-400 transition hover:bg-stone-100 hover:text-stone-700"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <div className="px-4 py-4">{children}</div>
        {footer ? (
          <div className="sticky bottom-0 flex flex-wrap items-center gap-2 border-t border-stone-100 bg-white/95 px-4 py-3 backdrop-blur-sm">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
