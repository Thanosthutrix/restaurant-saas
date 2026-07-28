"use client";

import { mergeMenuSuggestionsByNormalizedLabel } from "@/lib/mergeMenuSuggestions";
import type { MenuSuggestionItem } from "@/lib/menuSuggestionTypes";
import { supabase } from "@/lib/supabaseClient";
import {
  MENU_ANALYSIS_CLIENT_TIMEOUT_MS,
  MENU_ANALYSIS_TIMEOUT_USER_MESSAGE,
  withTimeout,
} from "@/lib/async/withTimeout";

export const MENU_IMPORT_STORAGE_BUCKET = "receipts";

export async function uploadMenuImageForRestaurant(
  file: File,
  restaurantId: string
): Promise<{ url: string; path: string } | { error: string }> {
  const ext =
    file.name.toLowerCase().endsWith(".pdf") ? "pdf" : file.type.includes("png") ? "png" : file.type.includes("webp") ? "webp" : "jpg";
  const safeRandom = crypto.randomUUID().replace(/-/g, "");
  const path = `${restaurantId}/menu-${safeRandom}.${ext}`;
  const { error } = await supabase.storage.from(MENU_IMPORT_STORAGE_BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) return { error: error.message };
  const { data } = supabase.storage.from(MENU_IMPORT_STORAGE_BUCKET).getPublicUrl(path);
  return { url: data.publicUrl, path };
}

async function postMenuAnalyze(body: Record<string, string>): Promise<Response> {
  return withTimeout(
    fetch("/api/menu-imports/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      credentials: "same-origin",
    }),
    MENU_ANALYSIS_CLIENT_TIMEOUT_MS,
    MENU_ANALYSIS_TIMEOUT_USER_MESSAGE
  );
}

/** Analyse via le chemin Storage (serveur télécharge avec la service role — bucket privé OK). */
export async function fetchMenuAnalysisFromStoragePath(
  bucket: string,
  path: string
): Promise<{ items: MenuSuggestionItem[]; error: string | null }> {
  let res: Response;
  try {
    res = await postMenuAnalyze({ storage_bucket: bucket, storage_path: path });
  } catch (e) {
    return {
      items: [],
      error: e instanceof Error ? e.message : MENU_ANALYSIS_TIMEOUT_USER_MESSAGE,
    };
  }
  const data = await res.json();
  const errorMessage = (data?.error as string | undefined) ?? (!res.ok ? "Erreur lors de l’analyse." : null);
  if (errorMessage) {
    return { items: [], error: errorMessage };
  }
  const itemsRaw = data?.items ?? data?.suggestions ?? [];
  const items = (Array.isArray(itemsRaw) ? itemsRaw : []) as MenuSuggestionItem[];
  return { items, error: null };
}

export async function fetchMenuAnalysisFromImageUrl(
  imageUrl: string
): Promise<{ items: MenuSuggestionItem[]; error: string | null }> {
  let res: Response;
  try {
    res = await postMenuAnalyze({ image_url: imageUrl });
  } catch (e) {
    return {
      items: [],
      error: e instanceof Error ? e.message : MENU_ANALYSIS_TIMEOUT_USER_MESSAGE,
    };
  }
  const data = await res.json();
  const errorMessage = (data?.error as string | undefined) ?? (!res.ok ? "Erreur lors de l’analyse." : null);
  if (errorMessage) {
    return { items: [], error: errorMessage };
  }
  const itemsRaw = data?.items ?? data?.suggestions ?? [];
  const items = (Array.isArray(itemsRaw) ? itemsRaw : []) as MenuSuggestionItem[];
  return { items, error: null };
}

/**
 * Upload + analyse de plusieurs photos de carte ; fusion des doublons par libellé normalisé.
 */
export async function uploadAndAnalyzeMenuPhotos(
  restaurantId: string,
  files: File[]
): Promise<{ items: MenuSuggestionItem[]; error: string | null }> {
  const merged: MenuSuggestionItem[] = [];
  for (const file of files) {
    const up = await uploadMenuImageForRestaurant(file, restaurantId);
    if ("error" in up) return { items: [], error: up.error };
    const { items, error } = await fetchMenuAnalysisFromStoragePath(MENU_IMPORT_STORAGE_BUCKET, up.path);
    if (error) return { items: [], error };
    merged.push(...items);
  }
  return { items: mergeMenuSuggestionsByNormalizedLabel(merged), error: null };
}
