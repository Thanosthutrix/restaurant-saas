"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useCallback } from "react";
import { ChevronLeft, LogOut } from "lucide-react";
import { signOut } from "@/app/login/actions";
import {
  SHELL_NAV_ITEMS,
  filterShellNavItems,
  isBareShellPath,
} from "@/components/app/premium/shell-nav";
import { BottomTabBar } from "@/components/app/premium/BottomTabBar";
import { HeaderRestaurantSelect } from "@/components/app/premium/HeaderRestaurantSelect";
import { HeaderWeatherWidget } from "@/components/app/premium/HeaderWeatherWidget";
import { HeaderUserAvatar } from "@/components/app/HeaderUserAvatar";
import { BrandLogo } from "@/components/app/BrandLogo";
import { OfflineNavigationGuard } from "@/components/offline/OfflineNavigationGuard";
import { OfflineStatusBar } from "@/components/offline/OfflineStatusBar";
import { OfflineSyncProvider } from "@/components/offline/OfflineSyncProvider";
import { SwipeBackNavigator } from "@/components/capacitor/SwipeBackNavigator";
import { MetaMessagingBackgroundSync } from "@/components/meta/MetaMessagingBackgroundSync";
import type { AppShellHeaderBootstrap } from "@/lib/app/shellHeaderBootstrap";
import { type ShellNavKey } from "@/lib/auth/appRoles";
import { prefetchRoutesWhenIdle } from "@/lib/ui/deferIdle";

type ShellClientPayload = Pick<
  AppShellHeaderBootstrap,
  "restaurants" | "currentRestaurantId" | "establishment" | "allowedNavKeys"
>;

const sidebarLinkBase =
  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150";
const sidebarIdle =
  "text-zinc-400 hover:bg-white/5 hover:text-zinc-100 active:scale-[0.99]";
const sidebarActive = "bg-copper-500/20 text-copper-300";
const navGroupOrder = ["Accueil", "Service", "Gestion"];
/** Routes les plus fréquentes — prefetch différé pour ne pas saturer le réseau au chargement. */
const hotPrefetchKeys = new Set<ShellNavKey>(["dashboard", "salle", "caisse", "cuisine"]);

function NavLinks({
  pathname,
  allowedNavKeys,
  hygieneBadge,
  cuisineBadge,
  onPrefetch,
}: {
  pathname: string | null;
  allowedNavKeys?: ShellNavKey[] | null;
  hygieneBadge?: number | null;
  cuisineBadge?: { count: number; tone: "red" | "blue" } | null;
  onPrefetch?: (href: string) => void;
}) {
  const items = filterShellNavItems(allowedNavKeys, { omitDashboard: true });

  const groupedItems = navGroupOrder
    .map((group) => ({
      group,
      items: items.filter((item) => item.group === group),
    }))
    .filter((entry) => entry.items.length > 0);

  return (
    <nav className="flex flex-1 flex-col gap-4 overflow-y-auto p-3" aria-label="Navigation principale">
      {groupedItems.map((entry) => (
        <div key={entry.group} className="space-y-1">
          <p className="px-3 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-zinc-500">
            {entry.group}
          </p>
          {entry.items.map((item) => {
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
                key={item.href}
                href={item.href}
                prefetch={true}
                onMouseEnter={() => onPrefetch?.(item.href)}
                onTouchStart={() => onPrefetch?.(item.href)}
                onFocus={() => onPrefetch?.(item.href)}
                className={`${sidebarLinkBase} ${active ? sidebarActive : sidebarIdle}`}
              >
                <Icon className="h-[1.125rem] w-[1.125rem] shrink-0 opacity-90" aria-hidden />
                {item.label}
                {badgeCount != null && (
                  <span
                    className={`ml-auto inline-flex min-w-[1.35rem] items-center justify-center rounded-full px-1.5 py-0.5 text-[0.7rem] font-bold leading-none text-white ${badgeCls}`}
                  >
                    {badgeCount > 99 ? "99+" : badgeCount}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

export function PremiumAppShell({
  children,
  headerBootstrap,
}: {
  children: React.ReactNode;
  headerBootstrap: AppShellHeaderBootstrap | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const bare = isBareShellPath(pathname);
  const [moreNavOpen, setMoreNavOpen] = useState(false);
  const [clientBootstrap, setClientBootstrap] = useState<ShellClientPayload | null>(null);
  const prefetchedRef = useRef(false);
  const shellPayload = headerBootstrap ?? clientBootstrap;

  const navigateBack = useCallback(() => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/dashboard");
    }
  }, [router]);

  useEffect(() => {
    if (bare || headerBootstrap) return;

    let cancelled = false;
    fetch("/api/restaurants/me", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then((payload: ShellClientPayload | null) => {
        if (!cancelled && payload) {
          setClientBootstrap(payload);
        }
      })
      .catch(() => {
        if (!cancelled) setClientBootstrap(null);
      });
    return () => {
      cancelled = true;
    };
  }, [bare, headerBootstrap]);

  const prefetchRoute = (href: string) => {
    router.prefetch(href);
  };

  useEffect(() => {
    if (bare || prefetchedRef.current) return;
    const allowedKeys = shellPayload?.allowedNavKeys;
    if (!allowedKeys?.length) return;

    prefetchedRef.current = true;
    const urls = SHELL_NAV_ITEMS.filter(
      (item) => hotPrefetchKeys.has(item.navKey) && allowedKeys.includes(item.navKey)
    ).map((item) => item.href);

    return prefetchRoutesWhenIdle((href) => router.prefetch(href), urls);
  }, [bare, router, shellPayload?.allowedNavKeys]);

  useEffect(() => {
    if (bare) return;

    const refreshIfVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (pathname.startsWith("/caisse") || pathname.startsWith("/salle")) return;
      router.refresh();
    };

    const id = window.setInterval(refreshIfVisible, 60_000);
    document.addEventListener("visibilitychange", refreshIfVisible);
    window.addEventListener("focus", refreshIfVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", refreshIfVisible);
      window.removeEventListener("focus", refreshIfVisible);
    };
  }, [bare, router, pathname]);

  if (bare) {
    return <>{children}</>;
  }

  return (
    <OfflineSyncProvider>
      <div className="min-h-screen bg-[#E9EDF2] text-stone-900">
        {/* Sidebar desktop */}
        <aside className="app-sidebar-w sidebar-graphite fixed left-0 top-0 z-40 hidden h-full flex-col lg:flex">
          <div className="flex items-center justify-center border-b border-white/5 px-4 py-5">
            <Link
              href="/dashboard"
              aria-label="ubion — tableau de bord"
              className="group flex items-center justify-center"
            >
              <BrandLogo role="img" aria-label="ubion" className="h-24 w-24" />
            </Link>
          </div>
          <NavLinks
            pathname={pathname}
            allowedNavKeys={shellPayload?.allowedNavKeys}
            hygieneBadge={headerBootstrap?.hygienePendingCount}
            cuisineBadge={headerBootstrap?.preparationsBadge}
            onPrefetch={prefetchRoute}
          />
          <div className="mt-auto border-t border-white/5 p-3">
            <form action={signOut}>
              <button
                type="submit"
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-zinc-500 transition hover:bg-rose-500/10 hover:text-rose-300 active:scale-[0.99]"
              >
                <LogOut className="h-[1.125rem] w-[1.125rem]" aria-hidden />
                Déconnexion
              </button>
            </form>
          </div>
        </aside>

        <div className="app-content-offset min-w-0">
          <header className="sticky top-0 z-[45] border-b border-slate-300/50 bg-[#E9EDF2]/95 pt-[env(safe-area-inset-top,0px)] supports-[backdrop-filter]:bg-[#E9EDF2]/80 supports-[backdrop-filter]:backdrop-blur-sm">
            <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
              <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={() => navigateBack()}
                  className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-stone-200 bg-white px-2.5 py-2 text-sm font-medium text-stone-700 shadow-sm transition hover:border-stone-300 hover:bg-stone-50 active:scale-[0.97] sm:px-3"
                  aria-label="Revenir à la page précédente"
                >
                  <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden />
                  <span className="hidden sm:inline">Retour</span>
                </button>
                <HeaderRestaurantSelect
                  clientFetchEnabled={true}
                  server={
                    shellPayload && shellPayload.restaurants.length > 0
                      ? {
                          restaurants: shellPayload.restaurants,
                          currentRestaurantId: shellPayload.currentRestaurantId,
                          establishment: shellPayload.establishment,
                        }
                      : null
                  }
                />
              </div>
              <div className="flex shrink-0 items-center gap-2 sm:gap-3">
                <HeaderWeatherWidget
                  shellHeaderReady={false}
                  initialWeather={headerBootstrap?.weather ?? undefined}
                  initialHint={headerBootstrap?.weatherHint ?? undefined}
                />
                {headerBootstrap?.userProfile && (
                  <HeaderUserAvatar
                    profile={headerBootstrap.userProfile}
                    usedColorIndexes={headerBootstrap.userProfile.usedColorIndexes}
                  />
                )}
                <form action={signOut} className="hidden sm:block">
                  <button
                    type="submit"
                    className="rounded-xl px-3 py-2 text-sm font-semibold text-stone-500 transition hover:bg-stone-100 hover:text-stone-800 active:scale-[0.98]"
                  >
                    Déconnexion
                  </button>
                </form>
              </div>
            </div>
          </header>

          <OfflineStatusBar />
          <OfflineNavigationGuard />
          <SwipeBackNavigator enabled={!moreNavOpen} onBack={navigateBack} />

          <main className="mx-auto min-w-0 w-full max-w-7xl px-4 pt-6 pb-4 sm:px-6 sm:pt-8 sm:pb-5 lg:px-8 lg:py-10">
            {children}
          </main>

          {/* Réserve la hauteur du bandeau bas sur toutes les pages (mobile / app). */}
          <div className="app-bottom-tabbar-spacer" aria-hidden />

          <BottomTabBar
            pathname={pathname}
            allowedNavKeys={shellPayload?.allowedNavKeys}
            hygieneBadge={headerBootstrap?.hygienePendingCount}
            cuisineBadge={headerBootstrap?.preparationsBadge}
            onMoreOpenChange={setMoreNavOpen}
            onPrefetch={prefetchRoute}
          />
          <MetaMessagingBackgroundSync restaurantId={shellPayload?.currentRestaurantId ?? null} />
        </div>
      </div>
    </OfflineSyncProvider>
  );
}
