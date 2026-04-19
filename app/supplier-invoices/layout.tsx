import { requireNavAccess } from "@/lib/auth/requireNavAccess";

export default async function SupplierInvoicesLayout({ children }: { children: React.ReactNode }) {
  await requireNavAccess("suppliers");
  return <>{children}</>;
}
