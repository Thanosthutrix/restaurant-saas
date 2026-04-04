import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseServer } from "@/lib/supabaseServer";
import type { MenuSuggestionItem } from "@/lib/menuSuggestionTypes";
import { analyzeMenuImage, analyzeMenuImageFromStoragePath } from "@/lib/menu-analysis";

export type AnalyzeMenuResponse = {
  success: boolean;
  items: MenuSuggestionItem[];
  error: string | null;
};

async function userOwnsRestaurantPrefix(userId: string, storagePath: string): Promise<boolean> {
  const prefix = storagePath.split("/")[0]?.trim();
  if (!prefix) return false;
  const { data } = await supabaseServer
    .from("restaurants")
    .select("id")
    .eq("id", prefix)
    .eq("owner_id", userId)
    .maybeSingle();
  return !!data;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const imageUrl = body?.image_url;
    const storageBucket = body?.storage_bucket;
    const storagePath = body?.storage_path;

    const useStorage =
      typeof storageBucket === "string" &&
      storageBucket.length > 0 &&
      typeof storagePath === "string" &&
      storagePath.length > 0;

    if (useStorage) {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        return NextResponse.json(
          { success: false, items: [], error: "Non connecté." } satisfies AnalyzeMenuResponse,
          { status: 401 }
        );
      }
      const ok = await userOwnsRestaurantPrefix(user.id, storagePath);
      if (!ok) {
        return NextResponse.json(
          { success: false, items: [], error: "Accès refusé à ce fichier." } satisfies AnalyzeMenuResponse,
          { status: 403 }
        );
      }
      const { suggestions, error } = await analyzeMenuImageFromStoragePath(storageBucket, storagePath);
      if (error) {
        console.warn("[menu-imports/analyze] analyzer error (storage)", error);
        return NextResponse.json({
          success: false,
          items: [],
          error,
        } satisfies AnalyzeMenuResponse);
      }
      return NextResponse.json({
        success: true,
        items: suggestions,
        error: null,
      } satisfies AnalyzeMenuResponse);
    }

    if (typeof imageUrl === "string" && imageUrl) {
      const { suggestions, error } = await analyzeMenuImage(imageUrl);
      if (error) {
        console.warn("[menu-imports/analyze] analyzer error (url)", error);
        return NextResponse.json({
          success: false,
          items: [],
          error,
        } satisfies AnalyzeMenuResponse);
      }
      return NextResponse.json({
        success: true,
        items: suggestions,
        error: null,
      } satisfies AnalyzeMenuResponse);
    }

    return NextResponse.json(
      {
        success: false,
        items: [],
        error: "Fournissez image_url ou storage_bucket + storage_path.",
      } satisfies AnalyzeMenuResponse,
      { status: 400 }
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Analysis failed";
    console.error("[menu-imports/analyze] error", e);
    return NextResponse.json(
      { success: false, items: [], error: message } satisfies AnalyzeMenuResponse,
      { status: 500 }
    );
  }
}
