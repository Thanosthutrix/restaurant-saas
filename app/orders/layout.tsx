import { requireAnyNavAccess } from "@/lib/auth/requireNavAccess";

export default async function OrdersLayout({ children }: { children: React.ReactNode }) {
  await requireAnyNavAccess(["orders", "orders_suggestions"]);
  return <>{children}</>;
}
