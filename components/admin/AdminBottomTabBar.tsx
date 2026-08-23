"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { LayoutGrid } from "lucide-react";
import {
  ADMIN_BOTTOM_TAB_KEYS,
  ADMIN_NAV_ITEMS,
} from "@/lib/admin/adminNav";
import { AdminMoreNavSheet } from "@/components/admin/AdminMoreNavSheet";
import { useBottomTabBarInset } from "@/components/app/premium/useBottomTabBarInset";
import { BrandLogo } from "@/components/app/BrandLogo";

type Props = {
  pathname: string | null;
  pendingTrialCount?: number;
  onMoreOpenChange?: (open: boolean) => void;
  onPrefetch?: (href: string) => void;
  /** Toujours visible (layout admin sans sidebar desktop). */
  alwaysVisible?: boolean;
};

/** Barre de navigation fixe en bas pour l'espace admin. */
export function AdminBottomTabBar({
  pathname,
  pendingTrialCount = 0,
  onMoreOpenChange,
  onPrefetch,
  alwaysVisible = false,
}: Props) {
  const [moreOpen, setMoreOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);

  const tabs = useMemo(
    () =>
      ADMIN_BOTTOM_TAB_KEYS.map((key) => ADMIN_NAV_ITEMS.find((item) => item.navKey === key)!).filter(
        Boolean
      ),
    []
  );

  const overflowItems = useMemo(() => {
    const bottomSet = new Set(ADMIN_BOTTOM_TAB_KEYS);
    return ADMIN_NAV_ITEMS.filter((item) => !bottomSet.has(item.navKey));
  }, []);

  const plusActive =
    moreOpen || overflowItems.some((item) => item.match(pathname ?? ""));

  const overflowBadgeCount =
    pendingTrialCount > 0 ? pendingTrialCount : null;

  useBottomTabBarInset(navRef, true);

  function openMore() {
    setMoreOpen(true);
    onMoreOpenChange?.(true);
  }

  function closeMore() {
    setMoreOpen(false);
    onMoreOpenChange?.(false);
  }

  const visibilityClass = alwaysVisible ? "" : "lg:hidden";

  return (
    <>
      <nav
        ref={navRef}
        className={`app-bottom-tabbar fixed bottom-0 left-0 right-0 z-50 border-t border-stone-200/80 bg-white/95 supports-[backdrop-filter]:bg-white/90 supports-[backdrop-filter]:backdrop-blur-md ${visibilityClass}`}
        style={{ paddingBottom: "max(0.35rem, env(safe-area-inset-bottom, 0px))" }}
        aria-label="Navigation admin"
        data-app-bottom-tabbar
      >
        <div className="mx-auto flex max-w-lg items-stretch justify-around px-1 pt-1">
          {tabs.map((item) => {
            const active = item.match(pathname ?? "");
            const Icon = item.icon;
            const label = item.shortLabel ?? item.label;
            const isHome = item.navKey === "home";

            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch
                onTouchStart={() => onPrefetch?.(item.href)}
                aria-label={isHome ? "Ubion Admin — tableau de bord" : undefined}
                className={`relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 py-1.5 transition active:scale-[0.96] ${
                  active ? "text-amber-700" : "text-stone-400"
                }`}
                aria-current={active ? "page" : undefined}
              >
                <span className="relative">
                  {isHome ? (
                    <BrandLogo
                      role="img"
                      aria-hidden
                      className={`h-7 w-7 transition ${active ? "opacity-100" : "opacity-75"}`}
                    />
                  ) : (
                    <Icon
                      className={`h-6 w-6 ${active ? "stroke-[2.25]" : "stroke-[1.75]"}`}
                      aria-hidden
                    />
                  )}
                </span>
                {!isHome ? (
                  <span className={`truncate text-[10px] font-medium leading-none ${active ? "font-semibold" : ""}`}>
                    {label}
                  </span>
                ) : null}
              </Link>
            );
          })}

          <button
            type="button"
            onClick={openMore}
            className={`relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 py-1.5 transition active:scale-[0.96] ${
              plusActive ? "text-amber-700" : "text-stone-400"
            }`}
            aria-expanded={moreOpen}
            aria-label="Autres rubriques admin"
          >
            <span className="relative">
              <LayoutGrid
                className={`h-6 w-6 ${plusActive ? "stroke-[2.25]" : "stroke-[1.75]"}`}
                aria-hidden
              />
              {overflowBadgeCount ? (
                <span className="absolute -right-2 -top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-0.5 text-[9px] font-bold text-white">
                  {overflowBadgeCount > 99 ? "99+" : overflowBadgeCount}
                </span>
              ) : null}
            </span>
            <span className={`text-[10px] font-medium leading-none ${plusActive ? "font-semibold" : ""}`}>
              Plus
            </span>
          </button>
        </div>
      </nav>

      <AdminMoreNavSheet
        open={moreOpen}
        onClose={closeMore}
        pathname={pathname}
        pendingTrialCount={pendingTrialCount}
        onPrefetch={onPrefetch}
      />
    </>
  );
}
