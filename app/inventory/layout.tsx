import { requireNavAccessOrReadonly } from "@/lib/auth/requireNavAccess";

export default async function InventoryLayout({ children }: { children: React.ReactNode }) {
  await requireNavAccessOrReadonly("inventory");
  return <>{children}</>;
}
