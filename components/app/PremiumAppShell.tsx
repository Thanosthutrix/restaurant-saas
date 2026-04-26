"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LogOut, Menu, X } from "lucide-react";
import { signOut } from "@/app/login/actions";
import { SHELL_NAV_ITEMS, isBareShellPath } from "@/components/app/premium/shell-nav";
import { HeaderRestaurantSelect } from "@/components/app/premium/HeaderRestaurantSelect";
import { HeaderWeatherWidget } from "@/components/app/premium/HeaderWeatherWidget";
import type { AppShellHeaderBootstrap } from "@/lib/app/shellHeaderBootstrap";
import type { ShellNavKey } from "@/lib/auth/appRoles";

const sidebarLinkBase =
  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150";
const sidebarIdle =
  "text-slate-600 hover:bg-slate-50 hover:text-slate-900 active:scale-[0.99]";
const sidebarActive = "bg-indigo-50 text-indigo-700 shadow-sm ring-1 ring-indigo-100";
const navGroupOrder = ["Accueil", "Exploitation", "Cuisine", "Achats & stock", "Registres", "Équipe & compte"];

function NavLinks({
  pathname,
  headerBootstrap,
  onNavigate,
}: {
  pathname: string | null;
  headerBootstrap: AppShellHeaderBootstrap | null;
  onNavigate?: () => void;
}) {
  const [clientAllowedKeys, setClientAllowedKeys] = useState<ShellNavKey[] | null>(null);
  const keys = headerBootstrap?.allowedNavKeys ?? clientAllowedKeys;

  useEffect(() => {
    if (headerBootstrap?.allowedNavKeys) return;

    let cancelled = false;
    fetch("/api/restaurants/me", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then((payload: { allowedNavKeys?: ShellNavKey[] } | null) => {
        if (!cancelled && payload?.allowedNavKeys) {
          setClientAllowedKeys(payload.allowedNavKeys);
        }
      })
      .catch(() => {
        if (!cancelled) setClientAllowedKeys(null);
      });
    return () => {
      cancelled = true;
    };
  }, [headerBootstrap?.allowedNavKeys]);

  const items =
    keys != null && keys.length > 0
      ? SHELL_NAV_ITEMS.filter((item) => keys.includes(item.navKey))
      : SHELL_NAV_ITEMS;

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
          <p className="px-3 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-slate-400">
            {entry.group}
          </p>
          {entry.items.map((item) => {
            const active = item.match(pathname ?? "");
            const Icon = item.icon;
            return (
              <Link
                key={item.navKey}
                href={item.href}
                onClick={onNavigate}
                className={`${sidebarLinkBase} ${active ? sidebarActive : sidebarIdle}`}
              >
                <Icon className="h-[1.125rem] w-[1.125rem] shrink-0 opacity-90" aria-hidden />
                {item.label}
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
  const bare = isBareShellPath(pathname);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  if (bare) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900">
      {/* Mobile overlay */}
      {mobileNavOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-slate-900/20 backdrop-blur-[2px] lg:hidden"
          aria-label="Fermer le menu"
          onClick={() => setMobileNavOpen(false)}
        />
      ) : null}

      {/* Sidebar desktop */}
      <aside className="fixed left-0 top-0 z-40 hidden h-full w-64 flex-col border-r border-slate-100 bg-white shadow-sm lg:flex">
        <div className="flex h-14 items-center border-b border-slate-100 px-4">
          <Link
            href="/dashboard"
            className="text-base font-semibold tracking-tight text-slate-900 transition hover:text-indigo-600"
          >
            Restaurant SaaS
          </Link>
        </div>
        <NavLinks pathname={pathname} headerBootstrap={headerBootstrap} />
        <div className="mt-auto border-t border-slate-100 p-3">
          <form action={signOut}>
            <button
              type="submit"
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-500 transition hover:bg-rose-50 hover:text-rose-700 active:scale-[0.99]"
            >
              <LogOut className="h-[1.125rem] w-[1.125rem]" aria-hidden />
              Déconnexion
            </button>
          </form>
        </div>
      </aside>

      {/* Sidebar mobile drawer */}
      <aside
        id="app-mobile-nav"
        aria-hidden={!mobileNavOpen}
        className={`fixed left-0 top-0 z-50 flex h-full w-64 flex-col border-r border-slate-100 bg-white shadow-xl transition-transform duration-200 ease-out lg:hidden ${
          mobileNavOpen
            ? "translate-x-0 pointer-events-auto"
            : "-translate-x-full pointer-events-none"
        }`}
      >
        <div className="flex h-14 items-center justify-between border-b border-slate-100 px-4">
          <Link
            href="/dashboard"
            className="text-base font-semibold tracking-tight text-slate-900"
            onClick={() => setMobileNavOpen(false)}
          >
            Restaurant SaaS
          </Link>
          <button
            type="button"
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            aria-label="Fermer"
            onClick={() => setMobileNavOpen(false)}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <NavLinks
          pathname={pathname}
          headerBootstrap={headerBootstrap}
          onNavigate={() => setMobileNavOpen(false)}
        />
        <div className="mt-auto border-t border-slate-100 p-3">
          <form action={signOut}>
            <button
              type="submit"
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-500 transition hover:bg-rose-50 hover:text-rose-700"
            >
              <LogOut className="h-[1.125rem] w-[1.125rem]" aria-hidden />
              Déconnexion
            </button>
          </form>
        </div>
      </aside>

      <div className="min-w-0 lg:pl-64">
        <header className="sticky top-0 z-[45] border-b border-slate-100/80 bg-white/80 backdrop-blur-md">
          <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
            <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
              <button
                type="button"
                className="inline-flex rounded-xl border border-slate-200 bg-white p-2 text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 active:scale-[0.97] lg:hidden"
                aria-expanded={mobileNavOpen}
                aria-controls="app-mobile-nav"
                onClick={() => setMobileNavOpen((o) => !o)}
              >
                {mobileNavOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
              <HeaderRestaurantSelect
                server={
                  headerBootstrap && headerBootstrap.restaurants.length > 0
                    ? {
                        restaurants: headerBootstrap.restaurants,
                        currentRestaurantId: headerBootstrap.currentRestaurantId,
                        establishment: headerBootstrap.establishment,
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
              <form action={signOut} className="hidden sm:block">
                <button
                  type="submit"
                  className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 active:scale-[0.98]"
                >
                  Déconnexion
                </button>
              </form>
            </div>
          </div>
        </header>

        <main className="mx-auto min-w-0 w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
          {children}
        </main>
      </div>
    </div>
  );
}
