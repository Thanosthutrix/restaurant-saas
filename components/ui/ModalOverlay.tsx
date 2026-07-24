"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export type ModalOverlayProps = {
  children: ReactNode;
  onClose?: () => void;
  zIndex?: number;
  ariaLabel?: string;
  backdropClassName?: string;
};

const DEFAULT_BACKDROP = "bg-stone-900/40 backdrop-blur-sm";

/**
 * Overlay plein écran via portail — toujours centré dans le viewport,
 * indépendamment du scroll de la page sous-jacente.
 */
export function ModalOverlay({
  children,
  onClose,
  zIndex = 50,
  ariaLabel,
  backdropClassName = DEFAULT_BACKDROP,
}: ModalOverlayProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    if (!onClose) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 overflow-y-auto overscroll-contain"
      style={{ zIndex }}
      role="presentation"
    >
      <div
        className={`fixed inset-0 ${backdropClassName}`}
        aria-hidden
        onClick={onClose}
      />
      <div className="relative flex min-h-[100dvh] min-h-full w-full items-center justify-center p-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] sm:p-6">
        <div
          className="relative mx-auto flex w-full flex-col items-center justify-center"
          role="dialog"
          aria-modal="true"
          aria-label={ariaLabel}
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}
