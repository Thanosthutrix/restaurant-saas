"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { LogOut } from "lucide-react";
import { SignOutButton } from "@/components/app/SignOutButton";
import { AdminBottomTabBar } from "@/components/admin/AdminBottomTabBar";
import { SwipeBackNavigator } from "@/components/capacitor/SwipeBackNavigator";

type Props = {
  children: React.ReactNode;
  userEmail?: string | null;
  pendingTrialCount?: number;
};

/** Shell mobile admin : header compact + barre du bas (sans sidebar). */
export function AdminShell({ children, userEmail, pendingTrialCount = 0 }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [moreNavOpen, setMoreNavOpen] = useState(false);

  useEffect(() => {
    document.documentElement.classList.add("admin-shell");
    return () => document.documentElement.classList.remove("admin-shell");
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 text-stone-900">
      <header className="sticky top-0 z-[45] border-b border-gray-200/80 bg-white/95 pt-[env(safe-area-inset-top,0px)] supports-[backdrop-filter]:bg-white/90 supports-[backdrop-filter]:backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-gray-900">Ubion Admin</p>
            <p className="truncate text-xs text-amber-600">Espace fondateur</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {userEmail ? (
              <span className="hidden max-w-[10rem] truncate text-xs text-gray-500 sm:inline">
                {userEmail}
              </span>
            ) : null}
            <SignOutButton className="inline-flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-xs font-semibold text-gray-500 transition hover:bg-gray-100 hover:text-gray-800 active:scale-[0.98]">
              <LogOut className="h-4 w-4" aria-hidden />
              <span className="hidden sm:inline">Déconnexion</span>
            </SignOutButton>
          </div>
        </div>
      </header>

      <SwipeBackNavigator
        enabled={!moreNavOpen}
        onBack={() => {
          if (typeof window !== "undefined" && window.history.length > 1) {
            router.back();
          } else {
            router.push("/admin");
          }
        }}
      />

      <main className="mx-auto min-w-0 w-full max-w-7xl px-4 pt-4 pb-4 [&_input:not([type=checkbox]):not([type=radio])]:text-gray-900 [&_input:not([type=checkbox]):not([type=radio])]:[color-scheme:light] [&_select]:text-gray-900 [&_select]:[color-scheme:light] [&_textarea]:text-gray-900 [&_textarea]:[color-scheme:light]">
        {children}
      </main>

      <div className="app-bottom-tabbar-spacer" aria-hidden />

      <AdminBottomTabBar
        pathname={pathname}
        pendingTrialCount={pendingTrialCount}
        onMoreOpenChange={setMoreNavOpen}
        onPrefetch={(href) => router.prefetch(href)}
        alwaysVisible
      />
    </div>
  );
}
