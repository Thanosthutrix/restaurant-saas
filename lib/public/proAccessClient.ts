/** Détection client de l'accès espace pro (propriétaire ou staff). */
export async function fetchHasProAccess(): Promise<boolean> {
  try {
    const res = await fetch("/api/restaurants/me", { credentials: "same-origin" });
    if (!res.ok) return false;
    const data = (await res.json()) as {
      restaurants?: unknown[];
      allowedNavKeys?: unknown[];
    };
    return (data.restaurants?.length ?? 0) > 0 || (data.allowedNavKeys?.length ?? 0) > 0;
  } catch {
    return false;
  }
}
