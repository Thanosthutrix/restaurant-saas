"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useOnlineStatus } from "@/lib/hooks/useOnlineStatus";
import { isRouteVisited, markRouteVisited, warmOfflineRoutes } from "@/lib/offline/visitedRoutes";

const TERRAIN_ROUTES = [
  "/dashboard",
  "/cuisine",
  "/hygiene",
  "/hygiene/temperatures-ouverture",
  "/hygiene/cuisine-plan",
  "/hygiene/a-faire",
  "/salle",
  "/caisse",
];

export function OfflineNavigationGuard() {
  const pathname = usePathname();
  const online = useOnlineStatus();
  const [blockedMessage, setBlockedMessage] = useState<string | null>(null);

  useEffect(() => {
    if (pathname) markRouteVisited(pathname);
  }, [pathname]);

  useEffect(() => {
    if (!online) return;
    void warmOfflineRoutes(TERRAIN_ROUTES);
  }, [online]);

  useEffect(() => {
    if (online) {
      setBlockedMessage(null);
      return;
    }

    function onClick(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const anchor = target.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;
      if (anchor.target === "_blank") return;

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) {
        return;
      }

      let url: URL;
      try {
        url = new URL(href, window.location.origin);
      } catch {
        return;
      }

      if (url.origin !== window.location.origin) return;
      if (normalize(url.pathname) === normalize(pathname ?? "")) return;

      if (!isRouteVisited(url.pathname)) {
        event.preventDefault();
        event.stopPropagation();
        setBlockedMessage(
          `« ${url.pathname} » n'est pas disponible hors ligne. Visitez cette page une fois connecté·e, ou restez sur l'écran actuel.`
        );
      }
    }

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [online, pathname]);

  if (!blockedMessage) return null;

  return (
    <div
      className="fixed bottom-4 left-4 right-4 z-[60] mx-auto max-w-lg rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 shadow-lg sm:left-auto"
      role="alert"
    >
      <div className="flex items-start gap-3">
        <p className="flex-1 leading-relaxed">{blockedMessage}</p>
        <button
          type="button"
          onClick={() => setBlockedMessage(null)}
          className="shrink-0 rounded-lg p-1 text-amber-700 transition hover:bg-amber-100"
          aria-label="Fermer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function normalize(pathname: string): string {
  const base = pathname.split("?")[0]?.split("#")[0] || "/";
  return base.endsWith("/") && base.length > 1 ? base.slice(0, -1) : base;
}
