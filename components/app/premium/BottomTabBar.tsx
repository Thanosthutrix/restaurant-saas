"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { LayoutGrid } from "lucide-react";
import {
  BOTTOM_TAB_NAV_KEYS,
  BOTTOM_TAB_SHORT_LABELS,
  SHELL_NAV_ITEMS,
  filterShellNavItems,
} from "@/components/app/premium/shell-nav";
import { MoreNavSheet } from "@/components/app/premium/MoreNavSheet";
import { useBottomTabBarInset } from "@/components/app/premium/useBottomTabBarInset";
import { BrandLogo } from "@/components/app/BrandLogo";
import type { ShellNavKey } from "@/lib/auth/appRoles";

type Props = {
  pathname: string | null;
  allowedNavKeys?: ShellNavKey[] | null;
  hygieneBadge?: number | null;
  cuisineBadge?: { count: number; tone: "red" | "blue" } | null;
  onMoreOpenChange?: (open: boolean) => void;
  onPrefetch?: (href: string) => void;
};

function tabBadge(
  navKey: ShellNavKey,
  hygieneBadge?: number | null,
  cuisineBadge?: { count: number; tone: "red" | "blue" } | null
): { count: number; tone: "red" | "blue" | "copper" } | null {
  if (navKey === "hygiene" && hygieneBadge) return { count: hygieneBadge, tone: "copper" };
  if (navKey === "cuisine" && cuisineBadge) return { count: cuisineBadge.count, tone: cuisineBadge.tone };
  return null;
}

/** Barre de navigation fixe en bas (mobile / app native). */
export function BottomTabBar({
  pathname,
  allowedNavKeys,
  hygieneBadge,
  cuisineBadge,
  onMoreOpenChange,
  onPrefetch,
}: Props) {
  const [moreOpen, setMoreOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);

  const tabs = useMemo(() => {
    const accessible = filterShellNavItems(allowedNavKeys);
    const accessibleKeys = new Set(accessible.map((i) => i.navKey));
    return BOTTOM_TAB_NAV_KEYS.filter((key) => accessibleKeys.has(key)).map((key) =>
      SHELL_NAV_ITEMS.find((i) => i.navKey === key)!
    );
  }, [allowedNavKeys]);

  const overflowItems = useMemo(() => {
    const bottomSet = new Set(BOTTOM_TAB_NAV_KEYS);
    return filterShellNavItems(allowedNavKeys).filter((item) => !bottomSet.has(item.navKey));
  }, [allowedNavKeys]);

  const plusActive =
    moreOpen || overflowItems.some((item) => item.match(pathname ?? ""));

  const overflowBadgeCount = useMemo(() => {
    let n = 0;
    if (hygieneBadge) n += hygieneBadge;
    if (cuisineBadge && !tabs.some((t) => t.navKey === "cuisine")) {
      n += cuisineBadge.count;
    }
    return n > 0 ? n : null;
  }, [hygieneBadge, cuisineBadge, tabs]);

  const tabBarVisible = tabs.length > 0 || overflowItems.length > 0;
  useBottomTabBarInset(navRef, tabBarVisible);

  function openMore() {
    setMoreOpen(true);
    onMoreOpenChange?.(true);
  }

  function closeMore() {
    setMoreOpen(false);
    onMoreOpenChange?.(false);
  }

  if (!tabBarVisible) return null;

  return (
    <>
      <nav
        ref={navRef}
        className="app-bottom-tabbar fixed bottom-0 left-0 right-0 z-50 border-t border-stone-200/80 bg-white/95 supports-[backdrop-filter]:bg-white/90 supports-[backdrop-filter]:backdrop-blur-md lg:hidden"
        style={{ paddingBottom: "max(0.35rem, env(safe-area-inset-bottom, 0px))" }}
        aria-label="Navigation principale"
        data-app-bottom-tabbar
      >
        <div className="mx-auto flex max-w-lg items-stretch justify-around px-1 pt-1">
          {tabs.map((item) => {
            const active = item.match(pathname ?? "");
            const Icon = item.icon;
            const badge = tabBadge(item.navKey, hygieneBadge, cuisineBadge);
            const label = BOTTOM_TAB_SHORT_LABELS[item.navKey] ?? item.label;
            const isHome = item.navKey === "dashboard";

            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch
                onTouchStart={() => onPrefetch?.(item.href)}
                aria-label={isHome ? "ubion — tableau de bord" : undefined}
                className={`relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 py-1.5 transition active:scale-[0.96] ${
                  active ? "text-copper-700" : "text-stone-400"
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
                  {!isHome && badge ? (
                    <span
                      className={`absolute -right-2 -top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full px-0.5 text-[9px] font-bold text-white ${
                        badge.tone === "red"
                          ? "bg-rose-600"
                          : badge.tone === "blue"
                            ? "bg-sky-500"
                            : "copper-sheen"
                      }`}
                    >
                      {badge.count > 99 ? "99+" : badge.count}
                    </span>
                  ) : null}
                </span>
                {!isHome ? (
                  <span className={`truncate text-[10px] font-medium leading-none ${active ? "font-semibold" : ""}`}>
                    {label}
                  </span>
                ) : null}
              </Link>
            );
          })}

          {overflowItems.length > 0 ? (
            <button
              type="button"
              onClick={openMore}
              className={`relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 py-1.5 transition active:scale-[0.96] ${
                plusActive ? "text-copper-700" : "text-stone-400"
              }`}
              aria-expanded={moreOpen}
              aria-label="Autres rubriques"
            >
              <span className="relative">
                <LayoutGrid
                  className={`h-6 w-6 ${plusActive ? "stroke-[2.25]" : "stroke-[1.75]"}`}
                  aria-hidden
                />
                {overflowBadgeCount ? (
                  <span className="copper-sheen absolute -right-2 -top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full px-0.5 text-[9px] font-bold text-white">
                    {overflowBadgeCount > 99 ? "99+" : overflowBadgeCount}
                  </span>
                ) : null}
              </span>
              <span className={`text-[10px] font-medium leading-none ${plusActive ? "font-semibold" : ""}`}>
                Plus
              </span>
            </button>
          ) : null}
        </div>
      </nav>

      <MoreNavSheet
        open={moreOpen}
        onClose={closeMore}
        pathname={pathname}
        allowedNavKeys={allowedNavKeys}
        hygieneBadge={hygieneBadge}
        cuisineBadge={cuisineBadge}
        bottomTabKeys={BOTTOM_TAB_NAV_KEYS}
        onPrefetch={onPrefetch}
      />
    </>
  );
}
