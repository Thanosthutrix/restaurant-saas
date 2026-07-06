import "server-only";

import { RESTAURANT_PUBLIC_BUCKET } from "@/lib/public/restaurantPublicShared";
import { supabaseServer } from "@/lib/supabaseServer";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 12 * 1024 * 1024;

export function restaurantPublicPhotoPath(
  restaurantId: string,
  kind: "thumb" | "cover",
  ext: string
): string {
  return `${restaurantId}/${kind}.${ext}`;
}

function extFromContentType(contentType: string): string {
  if (contentType === "image/png") return "png";
  if (contentType === "image/webp") return "webp";
  return "jpg";
}

export async function uploadRestaurantPublicPhoto(params: {
  restaurantId: string;
  kind: "thumb" | "cover";
  bytes: Uint8Array;
  contentType: string;
}): Promise<{ publicUrl: string; path: string }> {
  if (!ALLOWED_TYPES.has(params.contentType)) {
    throw new Error("Format accepté : JPEG, PNG ou WebP.");
  }
  if (params.bytes.byteLength > MAX_BYTES) {
    throw new Error("Image trop lourde (max. 12 Mo).");
  }

  const ext = extFromContentType(params.contentType);
  const path = restaurantPublicPhotoPath(params.restaurantId, params.kind, ext);

  const { error } = await supabaseServer.storage.from(RESTAURANT_PUBLIC_BUCKET).upload(path, params.bytes, {
    contentType: params.contentType,
    cacheControl: "3600",
    upsert: true,
  });

  if (error) throw new Error(error.message);

  const { data } = supabaseServer.storage.from(RESTAURANT_PUBLIC_BUCKET).getPublicUrl(path);
  return { publicUrl: data.publicUrl, path };
}
