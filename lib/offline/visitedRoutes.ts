const STORAGE_KEY = "ubion-offline-visited";

function normalizePath(pathname: string): string {
  const base = pathname.split("?")[0]?.split("#")[0] || "/";
  return base.endsWith("/") && base.length > 1 ? base.slice(0, -1) : base;
}

function loadVisited(): Set<string> {
  if (typeof window === "undefined") return new Set(["/"]);
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set(["/"]);
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set(["/"]);
    return new Set(parsed.filter((p): p is string => typeof p === "string").map(normalizePath));
  } catch {
    return new Set(["/"]);
  }
}

function saveVisited(set: Set<string>) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
}

/** Marque une route comme visitée en ligne (disponible hors ligne ensuite). */
export function markRouteVisited(pathname: string) {
  const set = loadVisited();
  set.add(normalizePath(pathname));
  saveVisited(set);
}

export function isRouteVisited(pathname: string): boolean {
  return loadVisited().has(normalizePath(pathname));
}

export function listVisitedRoutes(): string[] {
  return [...loadVisited()];
}

/** Pré-charge les pages terrain fréquentes pour remplir le cache du service worker. */
export async function warmOfflineRoutes(routes: string[]) {
  if (typeof window === "undefined" || !navigator.onLine) return;

  await Promise.all(
    routes.map(async (route) => {
      try {
        await fetch(route, {
          credentials: "include",
          headers: { RSC: "1", Accept: "text/x-component" },
        });
        markRouteVisited(route);
      } catch {
        /* ignore */
      }
    })
  );
}
