import { NextResponse } from "next/server";
import { createDeliveryNoteFromPurchaseOrder } from "@/lib/db";
import { getCurrentRestaurant } from "@/lib/auth";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params;
  const purchaseOrderId = resolvedParams?.id;

  if (!purchaseOrderId || purchaseOrderId === "undefined") {
    return NextResponse.json(
      { error: "purchase_order_id invalide dans l'URL." },
      { status: 400 }
    );
  }

  const restaurant = await getCurrentRestaurant();
  if (!restaurant) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const { data, error } = await createDeliveryNoteFromPurchaseOrder(purchaseOrderId);
  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Erreur lors de la création de la réception." },
      { status: 400 }
    );
  }

  if (data.restaurant_id !== restaurant.id) {
    return NextResponse.json(
      { error: "Cette commande fournisseur n'appartient pas à ce restaurant." },
      { status: 403 }
    );
  }

  return NextResponse.json({ id: data.id }, { status: 200 });
}
