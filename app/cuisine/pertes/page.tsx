import { redirect } from "next/navigation";
import { Trash2 } from "lucide-react";
import { getRestaurantForPage } from "@/lib/auth";
import { getDishes, getInventoryItems } from "@/lib/db";
import { listRecentWasteLogs } from "@/lib/analysis/wasteDb";
import { WasteLogClient } from "./WasteLogClient";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";

export default async function PertesPage() {
  const restaurant = await getRestaurantForPage();
  if (!restaurant) redirect("/onboarding");

  const [itemsRes, dishesRes, wasteRes] = await Promise.all([
    getInventoryItems(restaurant.id),
    getDishes(restaurant.id),
    listRecentWasteLogs(restaurant.id, 30),
  ]);

  const inventoryItems = (itemsRes.data ?? []).map((i) => ({
    id: i.id,
    name: i.name,
    unit: i.unit,
  }));
  const dishes = (dishesRes.data ?? []).map((d) => ({ id: d.id, name: d.name }));

  return (
    <PageContainer width="narrow">
      <PageHeader
        accentIcon={Trash2}
        accentTone="bg-rose-50 text-rose-700"
        breadcrumbs={[{ label: "Cuisine", href: "/cuisine" }, { label: "Pertes" }]}
        title="Pertes"
        subtitle="Saisie rapide en 2 clics — brute, prépa ou assiette. Alimente le stock et les analyses."
      />
      <WasteLogClient
        restaurantId={restaurant.id}
        inventoryItems={inventoryItems}
        dishes={dishes}
        initialLogs={wasteRes.data}
      />
    </PageContainer>
  );
}
