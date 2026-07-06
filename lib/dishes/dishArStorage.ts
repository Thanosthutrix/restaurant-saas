import "server-only";

import {
  DISH_AR_STORAGE_BUCKET,
  DISH_AR_SUPABASE_MAX_BYTES,
  type GlbOptimizePass,
  type PersistGlbResult,
} from "@/lib/dishes/dishArShared";
import { supabaseServer } from "@/lib/supabaseServer";

export {
  DISH_AR_STORAGE_BUCKET,
  DISH_AR_SUPABASE_MAX_BYTES,
  buildGlbStorageNote,
  formatGlbSizeMb,
  isEphemeralTripoModelUrl,
  isSupabaseDishArUrl,
  type PersistGlbResult,
} from "@/lib/dishes/dishArShared";

export function dishArSourcePath(restaurantId: string, dishId: string, ext: string) {
  return `${restaurantId}/${dishId}/source-${Date.now()}.${ext}`;
}

export function dishArModelPath(restaurantId: string, dishId: string) {
  return `${restaurantId}/${dishId}/model.glb`;
}

function isStorageSizeError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("maximum allowed size") ||
    m.includes("entitytoolarge") ||
    m.includes("payload too large") ||
    m.includes("413")
  );
}

export async function uploadDishArSourceImage(params: {
  restaurantId: string;
  dishId: string;
  bytes: Uint8Array;
  contentType: string;
  ext: string;
}): Promise<{ path: string; publicUrl: string }> {
  const path = dishArSourcePath(params.restaurantId, params.dishId, params.ext);
  const { error } = await supabaseServer.storage.from(DISH_AR_STORAGE_BUCKET).upload(path, params.bytes, {
    contentType: params.contentType,
    cacheControl: "3600",
    upsert: true,
  });
  if (error) throw new Error(error.message);

  const { data } = supabaseServer.storage.from(DISH_AR_STORAGE_BUCKET).getPublicUrl(path);
  return { path, publicUrl: data.publicUrl };
}

async function uploadGlbToSupabase(
  restaurantId: string,
  dishId: string,
  bytes: Uint8Array
): Promise<{ publicUrl: string } | { error: string }> {
  const path = dishArModelPath(restaurantId, dishId);
  const { error } = await supabaseServer.storage.from(DISH_AR_STORAGE_BUCKET).upload(path, bytes, {
    contentType: "model/gltf-binary",
    cacheControl: "86400",
    upsert: true,
  });

  if (error) {
    if (isStorageSizeError(error.message)) return { error: error.message };
    throw new Error(error.message);
  }

  const { data } = supabaseServer.storage.from(DISH_AR_STORAGE_BUCKET).getPublicUrl(path);
  return { publicUrl: data.publicUrl };
}

/**
 * Télécharge le .glb Tripo, l’optimise si besoin (< 50 Mo Supabase), puis stocke durablement.
 */
export async function persistDishGlbFromUrl(params: {
  restaurantId: string;
  dishId: string;
  glbUrl: string;
}): Promise<PersistGlbResult> {
  const res = await fetch(params.glbUrl, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Impossible de télécharger le modèle 3D (${res.status}).`);
  }
  const original = new Uint8Array(await res.arrayBuffer());

  let bytes = original;
  let optimizePass: GlbOptimizePass | "none" | null = null;

  try {
    const { shrinkGlbToSupabaseLimit } = await import("@/lib/dishes/glbOptimizeForStorage");
    const shrunk = await shrinkGlbToSupabaseLimit(original);
    bytes = new Uint8Array(shrunk.bytes);
    optimizePass = shrunk.pass;
  } catch {
    bytes = original;
  }

  if (bytes.byteLength > DISH_AR_SUPABASE_MAX_BYTES) {
    return {
      url: params.glbUrl,
      storage: "tripo_cdn",
      sizeBytes: bytes.byteLength,
      originalBytes: original.byteLength,
      optimizePass: optimizePass === "none" ? null : optimizePass,
    };
  }

  const uploaded = await uploadGlbToSupabase(params.restaurantId, params.dishId, bytes);
  if ("error" in uploaded) {
    return {
      url: params.glbUrl,
      storage: "tripo_cdn",
      sizeBytes: original.byteLength,
      originalBytes: original.byteLength,
      optimizePass: null,
    };
  }

  return {
    url: uploaded.publicUrl,
    storage: "supabase",
    sizeBytes: bytes.byteLength,
    originalBytes: original.byteLength,
    optimizePass,
  };
}
