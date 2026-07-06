import { NextResponse } from "next/server";
import { getPublicRestaurantWithDetails } from "@/lib/public/data";
import { buildRestaurantPhotoGallery } from "@/lib/public/restaurantPhotos";

type Props = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Props) {
  const { id } = await params;
  const data = await getPublicRestaurantWithDetails(id);

  if (!data) {
    return NextResponse.json({ error: "Restaurant introuvable." }, { status: 404 });
  }

  const { menu_items, reviews, ...restaurant } = data;
  const photos = buildRestaurantPhotoGallery(restaurant, menu_items);

  return NextResponse.json({ restaurant, menu_items, reviews, photos });
}
