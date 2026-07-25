"use client";

import Link from "next/link";
import { LogOut, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { signOut } from "@/app/login/actions";
import {
  filterShellNavItems,
  type ShellNavItem,
} from "@/components/app/premium/shell-nav";
import type { ShellNavKey } from "@/lib/auth/appRoles";

const navGroupOrderTyped = ["Accueil", "Service", "Gestion"] as const;

type Props = {
  open: boolean;
  onClose: () => void;
  pathname: string | null;
  allowedNavKeys?: ShellNavKey[] | null;
  hygieneBadge?: number | null;
  cuisineBadge?: { count: number; tone: "red" | "blue" } | null;
  bottomTabKeys: ShellNavKey[];
  onPrefetch?: (href: string) => void;
};

function NavRow({
  item,
  pathname,
  hygieneBadge,
  cuisineBadge,
  onNavigate,
  onPrefetch,
}: {
  item: ShellNavItem;
  pathname: string | null;
  hygieneBadge?: number | null;
  cuisineBadge?: { count: number; tone: "red" | "blue" } | null;
  onNavigate: () => void;
  onPrefetch?: (href: string) => void;
}) {
  const active = item.match(pathname ?? "");
  const Icon = item.icon;
  const hygieneN = item.navKey === "hygiene" && hygieneBadge ? hygieneBadge : null;
  const cuisineN = item.navKey === "cuisine" ? cuisineBadge ?? null : null;
  const badgeCount = cuisineN ? cuisineN.count : hygieneN;
  const badgeCls = cuisineN
    ? cuisineN.tone === "red"
      ? "bg-rose-600"
      : "bg-sky-500"
    : "copper-sheen";

  return (
    <Link
      href={item.href}
      prefetch
      onClick={onNavigate}
      onTouchStart={() => onPrefetch?.(item.href)}
      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition active:scale-[0.99] ${
        active ? "bg-copper-50 text-copper-800" : "text-stone-700 hover:bg-stone-50"
      }`}
    >
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
          active ? "bg-copper-100 text-copper-700" : "bg-stone-100 text-stone-600"
        }`}
      >
        <Icon className="h-[1.125rem] w-[1.125rem]" aria-hidden />
      </span>
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {badgeCount != null ? (
        <span
          className={`inline-flex min-w-[1.35rem] shrink-0 items-center justify-center rounded-full px-1.5 py-0.5 text-[0.7rem] font-bold leading-none text-white ${badgeCls}`}
        >
          {badgeCount > 99 ? "99+" : badgeCount}
        </span>
      ) : null}
    </Link>
  );
}

/** Feuille du bas : accès à toutes les rubriques hors onglets principaux. */
export function MoreNavSheet({
  open,
  onClose,
  pathname,
  allowedNavKeys,
  hygieneBadge,
  cuisineBadge,
  bottomTabKeys,
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

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!mounted || !open) return null;

  const bottomSet = new Set(bottomTabKeys);
  const items = filterShellNavItems(allowedNavKeys).filter((item) => !bottomSet.has(item.navKey));
  const groupedItems = navGroupOrderTyped
    .map((group) => ({
      group,
      items: items.filter((item) => item.group === group),
    }))
    .filter((entry) => entry.items.length > 0);

  return createPortal(
    <div className="more-nav-sheet-overlay fixed inset-0 z-[60] lg:hidden" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-stone-900/30 backdrop-blur-[2px]"
        aria-label="Fermer le menu"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Autres rubriques"
        className="absolute bottom-0 left-0 right-0 grid max-h-[100dvh] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-t-2xl border border-stone-200/80 bg-white shadow-2xl"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-stone-100 px-4 py-3">
          <p className="text-sm font-semibold text-stone-900">Rubriques</p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-stone-500 transition hover:bg-stone-100"
            aria-label="Fermer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav
          className="min-h-0 overflow-y-auto overscroll-contain px-3 pt-3"
          aria-label="Autres rubriques"
        >
          {groupedItems.map((entry) => (
            <div key={entry.group} className="mb-4 last:mb-0">
              <p className="px-3 pb-1 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-stone-400">
                {entry.group}
              </p>
              <div className="space-y-0.5">
                {entry.items.map((item) => (
                  <NavRow
                    key={item.href}
                    item={item}
                    pathname={pathname}
                    hygieneBadge={hygieneBadge}
                    cuisineBadge={cuisineBadge}
                    onNavigate={onClose}
                    onPrefetch={onPrefetch}
                  />
                ))}
              </div>
            </div>
          ))}
        </nav>
        <form
          action={signOut}
          className="shrink-0 border-t border-stone-100 pb-[max(0.35rem,env(safe-area-inset-bottom,0px))]"
        >
          <button
            type="submit"
            className="flex w-full items-center gap-3 px-4 py-3 text-sm font-semibold text-rose-600 transition hover:bg-rose-50 active:scale-[0.99]"
          >
            <LogOut className="h-[1.125rem] w-[1.125rem]" aria-hidden />
            Déconnexion
          </button>
        </form>
      </div>
    </div>,
    document.body
  );
}
