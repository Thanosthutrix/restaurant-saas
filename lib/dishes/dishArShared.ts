/** Constantes et helpers purs (safe client + serveur). */

export const DISH_AR_STORAGE_BUCKET = "dish-ar";

export const DISH_AR_SUPABASE_MAX_BYTES = 48 * 1024 * 1024;

export type GlbOptimizePass = "light" | "medium" | "strong" | "extreme" | "ultra";

export type PersistGlbResult = {
  url: string;
  storage: "supabase" | "tripo_cdn";
  sizeBytes: number;
  originalBytes: number;
  optimizePass: GlbOptimizePass | "none" | null;
};

export function formatGlbSizeMb(sizeBytes: number): string {
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} Mo`;
}

export function isSupabaseDishArUrl(url: string): boolean {
  return url.includes("/storage/v1/object/public/dish-ar/");
}

export function isEphemeralTripoModelUrl(url: string): boolean {
  if (isSupabaseDishArUrl(url)) return false;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host.includes("tripo") || host.includes("amazonaws.com");
  } catch {
    return false;
  }
}

export function buildGlbStorageNote(result: PersistGlbResult): string | null {
  if (result.storage === "tripo_cdn") {
    return `Modèle ${formatGlbSizeMb(result.originalBytes)} — trop lourd pour Supabase (50 Mo max). Lien Tripo temporaire.`;
  }
  if (result.optimizePass && result.optimizePass !== "none" && result.originalBytes > result.sizeBytes) {
    return `Modèle optimisé pour le stockage (${formatGlbSizeMb(result.originalBytes)} → ${formatGlbSizeMb(result.sizeBytes)}), qualité RA conservée.`;
  }
  return null;
}
