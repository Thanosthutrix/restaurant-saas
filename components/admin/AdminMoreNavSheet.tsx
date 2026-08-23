"use client";

import Link from "next/link";
import { LogOut, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { SignOutButton } from "@/components/app/SignOutButton";
import {
  ADMIN_BOTTOM_TAB_KEYS,
  ADMIN_NAV_ITEMS,
  type AdminNavItem,
} from "@/lib/admin/adminNav";

type Props = {
  open: boolean;
  onClose: () => void;
  pathname: string | null;
  pendingTrialCount?: number;
  onPrefetch?: (href: string) => void;
};

function NavRow({
  item,
  pathname,
  badge,
  onNavigate,
  onPrefetch,
}: {
  item: AdminNavItem;
  pathname: string | null;
  badge?: number;
  onNavigate: () => void;
  onPrefetch?: (href: string) => void;
}) {
  const active = item.match(pathname ?? "");
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      prefetch
      onClick={onNavigate}
      onTouchStart={() => onPrefetch?.(item.href)}
      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition active:scale-[0.99] ${
        active ? "bg-amber-50 text-amber-900" : "text-stone-700 hover:bg-stone-50"
      }`}
    >
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
          active ? "bg-amber-100 text-amber-700" : "bg-stone-100 text-stone-600"
        }`}
      >
        <Icon className="h-[1.125rem] w-[1.125rem]" aria-hidden />
      </span>
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {badge != null && badge > 0 ? (
        <span className="inline-flex min-w-[1.35rem] shrink-0 items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-[0.7rem] font-bold leading-none text-white">
          {badge > 99 ? "99+" : badge}
        </span>
      ) : null}
    </Link>
  );
}

/** Feuille « Plus » pour la navigation admin. */
export function AdminMoreNavSheet({
  open,
  onClose,
  pathname,
  pendingTrialCount = 0,
  onPrefetch,
}: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!mounted || !open) return null;

  const bottomSet = new Set(ADMIN_BOTTOM_TAB_KEYS);
  const overflowItems = ADMIN_NAV_ITEMS.filter((item) => !bottomSet.has(item.navKey));

  return createPortal(
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label="Autres rubriques admin">
      <button
        type="button"
        className="absolute inset-0 bg-stone-900/40 backdrop-blur-[2px]"
        aria-label="Fermer"
        onClick={onClose}
      />
      <div className="absolute inset-x-0 bottom-0 max-h-[min(85vh,32rem)] overflow-hidden rounded-t-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3">
          <p className="text-sm font-semibold text-stone-900">Administration</p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-stone-500 transition hover:bg-stone-100"
            aria-label="Fermer"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <div className="max-h-[min(calc(85vh-3.5rem),28rem)] overflow-y-auto px-3 py-3">
          <div className="space-y-1">
            {overflowItems.map((item) => (
              <NavRow
                key={item.href}
                item={item}
                pathname={pathname}
                badge={item.badgeKey === "trialRequests" ? pendingTrialCount : undefined}
                onNavigate={onClose}
                onPrefetch={onPrefetch}
              />
            ))}
          </div>
          <div className="mt-4 border-t border-stone-100 pt-3">
            <SignOutButton className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-stone-500 transition hover:bg-rose-50 hover:text-rose-700 active:scale-[0.99]">
              <LogOut className="h-[1.125rem] w-[1.125rem]" aria-hidden />
              Déconnexion
            </SignOutButton>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
