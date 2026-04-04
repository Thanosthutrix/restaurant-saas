"use client";

import { mergeMenuSuggestionsByNormalizedLabel } from "@/lib/mergeMenuSuggestions";
import type { MenuSuggestionItem } from "@/lib/menuSuggestionTypes";
import { supabase } from "@/lib/supabaseClient";

export const MENU_IMPORT_STORAGE_BUCKET = "receipts";

export async function uploadMenuImageForRestaurant(
  file: File,
  restaurantId: string
): Promise<{ url: string; path: string } | { error: string }> {
  const ext = file.type.includes("png") ? "png" : "jpg";
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

/** Analyse via le chemin Storage (serveur télécharge avec la service role — bucket privé OK). */
export async function fetchMenuAnalysisFromStoragePath(
  bucket: string,
  path: string
): Promise<{ items: MenuSuggestionItem[]; error: string | null }> {
  const res = await fetch("/api/menu-imports/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ storage_bucket: bucket, storage_path: path }),
    credentials: "same-origin",
  });
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
  const res = await fetch("/api/menu-imports/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image_url: imageUrl }),
    credentials: "same-origin",
  });
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
