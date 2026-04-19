import { requireNavAccess } from "@/lib/auth/requireNavAccess";

export default async function InventoryLayout({ children }: { children: React.ReactNode }) {
  await requireNavAccess("inventory");
  return <>{children}</>;
}
